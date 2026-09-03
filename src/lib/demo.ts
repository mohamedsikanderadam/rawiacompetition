import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { Campaign, Device } from "@/db/schema";
import { addDays, daysBetween, localDateKey, localDayStart } from "./time";

export const DEMO_TARGET = { a: 327, b: 294 } as const;

/** Deterministic PRNG so demo data is stable between runs. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted hour of day for a cafe: quiet mornings, lunch + evening peaks. */
function pickHour(rand: () => number): number {
  const weights = [0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 6, 7, 9, 9, 7, 6, 6, 7, 8, 8, 6, 4, 2, 1];
  const total = weights.reduce((s, w) => s + w, 0);
  let x = rand() * total;
  for (let h = 0; h < 24; h++) {
    x -= weights[h];
    if (x < 0) return h;
  }
  return 20;
}

/**
 * Deletes every vote (and every audit entry that references a vote) for the campaign and generates
 * demo votes spread across the campaign dates up to today, ending at UOS 327 / AUS 294.
 */
export async function resetDemoData(campaign: Campaign, device: Device, now: Date = new Date()): Promise<{ a: number; b: number }> {
  const rand = mulberry32(20260901);
  const today = localDateKey(now);
  const first = campaign.startDate;
  const last = today < campaign.endDate ? today : campaign.endDate;
  const days = Math.max(0, daysBetween(first, last)) + 1;

  const rows: (typeof schema.votes.$inferInsert)[] = [];
  const buildVotes = (code: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const dayIndex = Math.min(days - 1, Math.floor(rand() ** 0.85 * days)); // slight ramp-up over the month
      const ymd = addDays(first, dayIndex);
      const start = localDayStart(ymd).getTime();
      const hour = pickHour(rand);
      const ts = new Date(start + hour * 3_600_000 + Math.floor(rand() * 3_600_000));
      // Today's votes can only have happened between local midnight and now.
      const capped = ts > now ? new Date(start + Math.floor(rand() * Math.max(1, now.getTime() - start))) : ts;
      rows.push({
        campaignId: campaign.id,
        university: code,
        deviceId: device.id,
        sessionId: `demo-${randomBytes(6).toString("hex")}`,
        clientVoteId: `demo-${randomBytes(12).toString("hex")}`,
        createdAt: capped,
      });
    }
  };
  buildVotes(campaign.universityACode, DEMO_TARGET.a);
  buildVotes(campaign.universityBCode, DEMO_TARGET.b);
  rows.sort((x, y) => (x.createdAt as Date).getTime() - (y.createdAt as Date).getTime());

  await db.transaction(async (tx) => {
    await tx.delete(schema.votes).where(eq(schema.votes.campaignId, campaign.id));
    for (let i = 0; i < rows.length; i += 200) await tx.insert(schema.votes).values(rows.slice(i, i + 200));
    await tx.update(schema.campaigns).set({ mode: "demo", updatedAt: now }).where(eq(schema.campaigns.id, campaign.id));
  });
  return { a: DEMO_TARGET.a, b: DEMO_TARGET.b };
}

/** Clears all votes for the campaign and switches to live mode (UOS 0 / AUS 0). */
export async function startLiveCampaign(campaign: Campaign, now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(schema.votes).where(eq(schema.votes.campaignId, campaign.id)).returning({ id: schema.votes.id });
    await tx
      .update(schema.campaigns)
      .set({ mode: "live", active: true, updatedAt: now })
      .where(eq(schema.campaigns.id, campaign.id));
    return deleted.length;
  });
}
