import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Campaign } from "@/db/schema";
import { buildScoreboard, type Scoreboard, type Totals } from "./battle";

export const DEFAULT_CAMPAIGN = {
  name: "Rawia University Battle",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  universityACode: "UOS",
  universityAName: "University of Sharjah",
  universityBCode: "AUS",
  universityBName: "American University of Sharjah",
} as const;

/** The app runs one campaign at a time: the most recently created row. Creates it if missing. */
export async function getCampaign(): Promise<Campaign> {
  const rows = await db.select().from(schema.campaigns).orderBy(sql`${schema.campaigns.id} desc`).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(schema.campaigns).values(DEFAULT_CAMPAIGN).returning();
  return inserted[0];
}

export async function getTotals(campaign: Campaign): Promise<Totals> {
  const rows = await db
    .select({ university: schema.votes.university, n: count() })
    .from(schema.votes)
    .where(and(eq(schema.votes.campaignId, campaign.id), eq(schema.votes.status, "valid")))
    .groupBy(schema.votes.university);
  const totals: Totals = { a: 0, b: 0 };
  for (const r of rows) {
    if (r.university === campaign.universityACode) totals.a = Number(r.n);
    else if (r.university === campaign.universityBCode) totals.b = Number(r.n);
  }
  return totals;
}

export async function getScoreboard(campaign: Campaign): Promise<Scoreboard> {
  return buildScoreboard(campaign, await getTotals(campaign));
}
