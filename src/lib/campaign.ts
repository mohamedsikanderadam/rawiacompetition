import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Campaign, ContestantRow } from "@/db/schema";
import { buildScoreboard, type Contestant, type Scoreboard, type Totals } from "./battle";

export const DEFAULT_CAMPAIGN = {
  name: "Rawia University Battle",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
} as const;

export const DEFAULT_CONTESTANTS: Contestant[] = [
  { code: "UOS", name: "University of Sharjah" },
  { code: "AUS", name: "American University of Sharjah" },
];

/** The app runs one campaign at a time: the most recently created row. Creates it (with default contestants) if missing. */
export async function getCampaign(): Promise<Campaign> {
  const rows = await db.select().from(schema.campaigns).orderBy(sql`${schema.campaigns.id} desc`).limit(1);
  if (rows[0]) return rows[0];
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(schema.campaigns).values(DEFAULT_CAMPAIGN).returning();
    await tx.insert(schema.contestants).values(DEFAULT_CONTESTANTS.map((c, position) => ({ ...c, position, campaignId: inserted[0].id })));
    return inserted[0];
  });
}

/** Contestants in display order. */
export async function getContestants(campaign: Pick<Campaign, "id">): Promise<ContestantRow[]> {
  return db
    .select()
    .from(schema.contestants)
    .where(eq(schema.contestants.campaignId, campaign.id))
    .orderBy(asc(schema.contestants.position), asc(schema.contestants.id));
}

export async function getTotals(campaign: Pick<Campaign, "id">): Promise<Totals> {
  const rows = await db
    .select({ university: schema.votes.university, n: count() })
    .from(schema.votes)
    .where(and(eq(schema.votes.campaignId, campaign.id), eq(schema.votes.status, "valid")))
    .groupBy(schema.votes.university);
  const totals: Totals = {};
  for (const r of rows) totals[r.university] = Number(r.n);
  return totals;
}

export async function getScoreboard(campaign: Pick<Campaign, "id">, contestants?: Contestant[]): Promise<Scoreboard> {
  const [list, totals] = await Promise.all([contestants ?? getContestants(campaign), getTotals(campaign)]);
  return buildScoreboard(list, totals);
}
