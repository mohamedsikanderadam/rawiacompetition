/**
 * Integration tests against the real PostgreSQL database in DATABASE_URL.
 * They create their own campaign/device rows and remove them afterwards.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import type { Campaign, Device } from "@/db/schema";
import { buildScoreboard } from "@/lib/battle";
import { getTotals } from "@/lib/campaign";
import { castVote, findDeviceByToken, generateDeviceToken, hashToken, invalidateVote, restoreVote, DUPLICATE_WINDOW_MS } from "@/lib/votes";

let campaign: Campaign;
let device: Device;
let inactiveDevice: Device;
const token = generateDeviceToken();
const admin = { id: 0, email: "test-admin@rawia.cafe" };
let adminId = 0;

const at = (iso: string) => new Date(iso);
let seq = 0;
const ids = () => ({ sessionId: `sess-${Date.now()}-${++seq}`, clientVoteId: `cv-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 10)}` });

beforeAll(async () => {
  campaign = (
    await db
      .insert(schema.campaigns)
      .values({
        name: "Test Battle",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        universityACode: "UOS",
        universityAName: "University of Sharjah",
        universityBCode: "AUS",
        universityBName: "American University of Sharjah",
        mode: "live",
      })
      .returning()
  )[0];
  device = (await db.insert(schema.devices).values({ deviceName: "Test Kiosk", deviceIdentifier: `TEST-KIOSK-${Date.now()}`, tokenHash: hashToken(token) }).returning())[0];
  inactiveDevice = (
    await db.insert(schema.devices).values({ deviceName: "Old Kiosk", deviceIdentifier: `TEST-OLD-${Date.now()}`, tokenHash: hashToken(generateDeviceToken()), active: false }).returning()
  )[0];
  const a = (await db.insert(schema.adminUsers).values({ email: `test-${Date.now()}@rawia.cafe`, passwordHash: "x" }).returning())[0];
  adminId = a.id;
  admin.id = a.id;
  admin.email = a.email;
});

afterAll(async () => {
  await db.delete(schema.auditLogs).where(eq(schema.auditLogs.adminUserId, adminId));
  await db.delete(schema.votes).where(eq(schema.votes.campaignId, campaign.id));
  await db.delete(schema.devices).where(eq(schema.devices.id, device.id));
  await db.delete(schema.devices).where(eq(schema.devices.id, inactiveDevice.id));
  await db.delete(schema.adminUsers).where(eq(schema.adminUsers.id, adminId));
  await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id));
});

describe("device tokens", () => {
  it("resolves a device from its token and rejects unknown tokens", async () => {
    expect((await findDeviceByToken(token))?.id).toBe(device.id);
    expect(await findDeviceByToken("rk_definitely_not_a_real_token")).toBeNull();
    expect(await findDeviceByToken("")).toBeNull();
  });
});

describe("castVote", () => {
  it("records a UOS vote and an AUS vote as individual rows", async () => {
    const r1 = await castVote({ campaign, device, university: "UOS", ...ids(), now: at("2026-09-03T10:00:00Z") });
    const r2 = await castVote({ campaign, device, university: "AUS", ...ids(), now: at("2026-09-03T10:00:05Z") });
    expect(r1.ok && r1.vote.university).toBe("UOS");
    expect(r2.ok && r2.vote.university).toBe("AUS");
    expect(await getTotals(campaign)).toEqual({ a: 1, b: 1 });
  });

  it("treats a retried request with the same clientVoteId as the same vote", async () => {
    const input = { campaign, device, university: "UOS", ...ids(), now: at("2026-09-03T11:00:00Z") };
    const first = await castVote(input);
    const retry = await castVote({ ...input, now: at("2026-09-03T11:00:00.300Z") });
    expect(first.ok && retry.ok && retry.vote.id).toBe(first.ok && first.vote.id);
    expect(retry.ok && retry.duplicate).toBe(true);
    expect(await getTotals(campaign)).toEqual({ a: 2, b: 1 });
  });

  it("rejects a second tap from the same device inside the duplicate window", async () => {
    const t0 = at("2026-09-03T12:00:00Z");
    const ok = await castVote({ campaign, device, university: "AUS", ...ids(), now: t0 });
    const tooFast = await castVote({ campaign, device, university: "AUS", ...ids(), now: new Date(t0.getTime() + DUPLICATE_WINDOW_MS - 100) });
    const later = await castVote({ campaign, device, university: "AUS", ...ids(), now: new Date(t0.getTime() + DUPLICATE_WINDOW_MS + 100) });
    expect(ok.ok).toBe(true);
    expect(!tooFast.ok && tooFast.code).toBe("too_fast");
    expect(later.ok).toBe(true);
    expect(await getTotals(campaign)).toEqual({ a: 2, b: 3 });
  });

  it("survives rapid concurrent taps: exactly one vote is stored", async () => {
    const before = await getTotals(campaign);
    const t = at("2026-09-03T13:00:00Z");
    const results = await Promise.all(Array.from({ length: 8 }, () => castVote({ campaign, device, university: "UOS", ...ids(), now: t })));
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.code === "too_fast").length).toBe(7);
    expect((await getTotals(campaign)).a).toBe(before.a + 1);
  });

  it("rejects inactive devices, invalid universities and bad ids", async () => {
    const inactive = await castVote({ campaign, device: inactiveDevice, university: "UOS", ...ids(), now: at("2026-09-04T10:00:00Z") });
    expect(!inactive.ok && inactive.code).toBe("device_inactive");
    const bad = await castVote({ campaign, device, university: "MIT", ...ids(), now: at("2026-09-04T10:00:00Z") });
    expect(!bad.ok && bad.code).toBe("invalid_university");
    const badId = await castVote({ campaign, device, university: "UOS", sessionId: "x", clientVoteId: "y", now: at("2026-09-04T10:00:00Z") });
    expect(!badId.ok && badId.code).toBe("invalid_input");
  });

  it("rejects votes when the campaign is paused, expired or not started", async () => {
    const paused = await castVote({ campaign: { ...campaign, active: false }, device, university: "UOS", ...ids(), now: at("2026-09-05T10:00:00Z") });
    expect(!paused.ok && paused.code).toBe("campaign_inactive");
    const expired = await castVote({ campaign, device, university: "UOS", ...ids(), now: at("2026-10-01T10:00:00Z") });
    expect(!expired.ok && expired.code).toBe("campaign_ended");
    const early = await castVote({ campaign, device, university: "UOS", ...ids(), now: at("2026-08-20T10:00:00Z") });
    expect(!early.ok && early.code).toBe("campaign_not_started");
    const reopened = await castVote({ campaign: { ...campaign, reopened: true }, device, university: "UOS", ...ids(), now: at("2026-10-01T10:00:00Z") });
    expect(reopened.ok).toBe(true);
  });
});

describe("vote invalidation", () => {
  it("soft-deletes a vote, logs it, recalculates the leaderboard and can restore it", async () => {
    const before = await getTotals(campaign);
    const r = await castVote({ campaign, device, university: "UOS", ...ids(), now: at("2026-09-30T12:00:00Z") });
    if (!r.ok) throw new Error("vote failed");
    expect((await getTotals(campaign)).a).toBe(before.a + 1);

    const invalidated = await invalidateVote({ voteId: r.vote.id, admin, reason: "Accidental duplicate" });
    expect(invalidated?.status).toBe("invalid");
    expect((await getTotals(campaign)).a).toBe(before.a);

    const log = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.voteId, r.vote.id));
    expect(log.some((l) => l.action === "vote.invalidated" && l.reason === "Accidental duplicate" && l.adminEmail === admin.email)).toBe(true);

    // Invalidating twice is a no-op.
    expect(await invalidateVote({ voteId: r.vote.id, admin, reason: "again" })).toBeNull();

    const restored = await restoreVote({ voteId: r.vote.id, admin, reason: "was valid after all" });
    expect(restored?.status).toBe("valid");
    expect((await getTotals(campaign)).a).toBe(before.a + 1);
  });

  it("leaderboard from database totals matches the pure calculation", async () => {
    const totals = await getTotals(campaign);
    const board = buildScoreboard(campaign, totals);
    expect(board.total).toBe(totals.a + totals.b);
    expect(board.leader).toBe(totals.a === totals.b ? null : totals.a > totals.b ? "UOS" : "AUS");
  });
});
