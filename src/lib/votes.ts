import { and, desc, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { Campaign, Device, Vote } from "@/db/schema";
import { getCampaignStatus, isValidUniversity } from "./battle";

/** Two votes from the same device closer than this are treated as an accidental double tap. */
export const DUPLICATE_WINDOW_MS = 1500;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateDeviceToken(): string {
  return `rk_${randomBytes(24).toString("base64url")}`;
}

export async function findDeviceByToken(token: string | undefined | null): Promise<Device | null> {
  if (!token || token.length < 16 || token.length > 200) return null;
  const rows = await db.select().from(schema.devices).where(eq(schema.devices.tokenHash, hashToken(token))).limit(1);
  return rows[0] ?? null;
}

export type CastVoteInput = {
  campaign: Campaign;
  device: Device;
  university: string;
  sessionId: string;
  clientVoteId: string;
  now?: Date;
};

export type CastVoteResult =
  | { ok: true; vote: Vote; duplicate: boolean }
  | { ok: false; code: "campaign_inactive" | "campaign_ended" | "campaign_not_started" | "device_inactive" | "invalid_university" | "too_fast" | "invalid_input"; message: string };

const ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Records exactly one vote. Server-side protection against accidental duplicates:
 *  1. `clientVoteId` is unique — a retried request returns the original vote instead of a new one.
 *  2. The device row is locked for the duration, and a second vote from the same device
 *     within DUPLICATE_WINDOW_MS is rejected as a double tap.
 */
export async function castVote(input: CastVoteInput): Promise<CastVoteResult> {
  const { campaign, device, university, sessionId, clientVoteId } = input;
  const now = input.now ?? new Date();

  if (!ID_RE.test(sessionId) || !ID_RE.test(clientVoteId)) {
    return { ok: false, code: "invalid_input", message: "Invalid session or vote id." };
  }
  if (!device.active) return { ok: false, code: "device_inactive", message: "This kiosk has been deactivated." };
  if (!isValidUniversity(campaign, university)) {
    return { ok: false, code: "invalid_university", message: "Unknown university." };
  }
  const status = getCampaignStatus(campaign, now);
  if (status.phase === "paused") return { ok: false, code: "campaign_inactive", message: "Voting is paused." };
  if (status.phase === "ended") return { ok: false, code: "campaign_ended", message: "The battle is over." };
  if (status.phase === "upcoming") return { ok: false, code: "campaign_not_started", message: "The battle has not started yet." };

  return db.transaction(async (tx) => {
    // Serialise votes per device so the double-tap check can't race.
    await tx.execute(sql`select id from ${schema.devices} where id = ${device.id} for update`);

    const existing = await tx.select().from(schema.votes).where(eq(schema.votes.clientVoteId, clientVoteId)).limit(1);
    if (existing[0]) return { ok: true, vote: existing[0], duplicate: true };

    const last = await tx
      .select({ createdAt: schema.votes.createdAt })
      .from(schema.votes)
      .where(and(eq(schema.votes.deviceId, device.id), eq(schema.votes.campaignId, campaign.id)))
      .orderBy(desc(schema.votes.createdAt))
      .limit(1);
    if (last[0] && Math.abs(now.getTime() - last[0].createdAt.getTime()) < DUPLICATE_WINDOW_MS) {
      return { ok: false, code: "too_fast", message: "Double tap ignored — one vote per purchase." };
    }

    const inserted = await tx
      .insert(schema.votes)
      .values({
        campaignId: campaign.id,
        university,
        deviceId: device.id,
        sessionId,
        clientVoteId,
        createdAt: now,
      })
      .returning();
    await tx.update(schema.devices).set({ lastSeenAt: now }).where(eq(schema.devices.id, device.id));
    return { ok: true, vote: inserted[0], duplicate: false };
  });
}

export async function invalidateVote(opts: { voteId: number; admin: { id: number; email: string }; reason: string }): Promise<Vote | null> {
  const reason = opts.reason.trim().slice(0, 500);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.votes)
      .set({ status: "invalid", invalidatedAt: new Date(), invalidatedBy: opts.admin.id, invalidReason: reason || null })
      .where(and(eq(schema.votes.id, opts.voteId), eq(schema.votes.status, "valid")))
      .returning();
    if (!updated[0]) return null;
    await tx.insert(schema.auditLogs).values({
      adminUserId: opts.admin.id,
      adminEmail: opts.admin.email,
      action: "vote.invalidated",
      voteId: opts.voteId,
      reason: reason || null,
      details: { university: updated[0].university, votedAt: updated[0].createdAt.toISOString() },
    });
    return updated[0];
  });
}

export async function restoreVote(opts: { voteId: number; admin: { id: number; email: string }; reason: string }): Promise<Vote | null> {
  const reason = opts.reason.trim().slice(0, 500);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(schema.votes)
      .set({ status: "valid", invalidatedAt: null, invalidatedBy: null, invalidReason: null })
      .where(and(eq(schema.votes.id, opts.voteId), eq(schema.votes.status, "invalid")))
      .returning();
    if (!updated[0]) return null;
    await tx.insert(schema.auditLogs).values({
      adminUserId: opts.admin.id,
      adminEmail: opts.admin.email,
      action: "vote.restored",
      voteId: opts.voteId,
      reason: reason || null,
    });
    return updated[0];
  });
}
