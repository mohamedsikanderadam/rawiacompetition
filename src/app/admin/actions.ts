"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { clearSessionCookie, getAdminSession, requireAdmin, setSessionCookie, verifyCredentials } from "@/lib/auth";
import { MAX_CONTESTANTS, MIN_CONTESTANTS } from "@/lib/battle";
import { getCampaign, getContestants } from "@/lib/campaign";
import { resetDemoData, resetScores, startLiveCampaign } from "@/lib/demo";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { generateDeviceToken, hashToken, invalidateVote, restoreVote } from "@/lib/votes";

export type ActionResult = { ok: true; message?: string; token?: string } | { ok: false; message: string };

async function audit(admin: { id: number; email: string }, action: string, extra: { voteId?: number; reason?: string; details?: unknown } = {}) {
  await db.insert(schema.auditLogs).values({
    adminUserId: admin.id,
    adminEmail: admin.email,
    action,
    voteId: extra.voteId,
    reason: extra.reason,
    details: extra.details ?? null,
  });
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
  revalidatePath("/battle");
}

// ---------- auth ----------

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ip = clientIp(await headers());
  const rl = rateLimit(`login:${ip}`, 8, 15 * 60_000);
  if (!rl.ok) return { ok: false, message: "Too many login attempts. Try again in a few minutes." };

  const parsed = z
    .object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200), next: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter your username and password." };

  const admin = await verifyCredentials(parsed.data.username, parsed.data.password);
  if (!admin) return { ok: false, message: "Incorrect username or password." };

  await setSessionCookie(admin);
  await audit(admin, "admin.login", { details: { ip } });
  const next = parsed.data.next && parsed.data.next.startsWith("/admin") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/admin";
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const admin = await getAdminSession();
  if (admin) await audit(admin, "admin.logout");
  await clearSessionCookie();
  redirect("/admin/login");
}

// ---------- votes ----------

export async function invalidateVoteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const voteId = Number(formData.get("voteId"));
  const reason = String(formData.get("reason") ?? "");
  if (Number.isInteger(voteId)) await invalidateVote({ voteId, admin, reason });
  revalidateAdmin();
}

export async function restoreVoteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const voteId = Number(formData.get("voteId"));
  const reason = String(formData.get("reason") ?? "");
  if (Number.isInteger(voteId)) await restoreVote({ voteId, admin, reason });
  revalidateAdmin();
}

// ---------- devices ----------

const deviceSchema = z.object({
  deviceName: z.string().trim().min(1).max(80),
  deviceIdentifier: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only")
    .transform((s) => s.toUpperCase()),
});

export async function createDeviceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = deviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid device details." };

  const existing = await db.select({ id: schema.devices.id }).from(schema.devices).where(eq(schema.devices.deviceIdentifier, parsed.data.deviceIdentifier)).limit(1);
  if (existing[0]) return { ok: false, message: "A device with this identifier already exists." };

  const token = generateDeviceToken();
  const inserted = await db.insert(schema.devices).values({ ...parsed.data, tokenHash: hashToken(token) }).returning();
  await audit(admin, "device.created", { details: { deviceId: inserted[0].id, identifier: parsed.data.deviceIdentifier } });
  revalidateAdmin();
  return { ok: true, message: `Device ${parsed.data.deviceIdentifier} created. Copy the token now — it will not be shown again.`, token };
}

export async function setDeviceActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("deviceId"));
  const active = formData.get("active") === "true";
  if (!Number.isInteger(id)) return;
  await db.update(schema.devices).set({ active }).where(eq(schema.devices.id, id));
  await audit(admin, active ? "device.activated" : "device.deactivated", { details: { deviceId: id } });
  revalidateAdmin();
}

export async function rotateDeviceTokenAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("deviceId"));
  if (!Number.isInteger(id)) return { ok: false, message: "Invalid device." };
  const token = generateDeviceToken();
  const updated = await db.update(schema.devices).set({ tokenHash: hashToken(token) }).where(eq(schema.devices.id, id)).returning();
  if (!updated[0]) return { ok: false, message: "Device not found." };
  await audit(admin, "device.token_rotated", { details: { deviceId: id, identifier: updated[0].deviceIdentifier } });
  revalidateAdmin();
  return { ok: true, message: `New token for ${updated[0].deviceIdentifier}. The kiosk must be re-authorised with it.`, token };
}

// ---------- settings ----------

const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    headline: z.string().trim().min(1).max(60),
    headlineAccent: z.string().trim().min(1).max(60),
    subline: z.string().trim().min(1).max(160),
    confirmationDurationMs: z.coerce.number().int().min(1000).max(10000),
    attractTimeoutMs: z.coerce.number().int().min(10000).max(600000),
    showScoresOnVote: z.coerce.boolean(),
    showConfirmationScore: z.coerce.boolean(),
    attractEnabled: z.coerce.boolean(),
    active: z.coerce.boolean(),
    reopened: z.coerce.boolean(),
  })
  .refine((s) => s.startDate <= s.endDate, { message: "End date must be on or after the start date." });

const contestantSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Every contestant needs a short code.")
    .max(12, "Short codes are at most 12 characters.")
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "Every contestant needs a full name.").max(120),
});

const contestantsSchema = z
  .array(contestantSchema)
  .min(MIN_CONTESTANTS, `A battle needs at least ${MIN_CONTESTANTS} contestants.`)
  .max(MAX_CONTESTANTS, `A battle can have at most ${MAX_CONTESTANTS} contestants.`)
  .refine((list) => new Set(list.map((c) => c.code)).size === list.length, { message: "Contestant codes must be unique." });

/** Reads `contestantCode[]` / `contestantName[]` pairs (in order) from the settings form. */
function parseContestants(formData: FormData) {
  const codes = formData.getAll("contestantCode").map(String);
  const names = formData.getAll("contestantName").map(String);
  return contestantsSchema.safeParse(codes.map((code, i) => ({ code, name: names[i] ?? "" })));
}

function checkbox(formData: FormData, key: string): "true" | "" {
  return formData.get(key) === "on" ? "true" : "";
}

export async function saveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const raw = {
    ...Object.fromEntries(formData),
    showScoresOnVote: checkbox(formData, "showScoresOnVote"),
    showConfirmationScore: checkbox(formData, "showConfirmationScore"),
    attractEnabled: checkbox(formData, "attractEnabled"),
    active: checkbox(formData, "active"),
    reopened: checkbox(formData, "reopened"),
  };
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const contestants = parseContestants(formData);
  if (!contestants.success) return { ok: false, message: contestants.error.issues[0]?.message ?? "Invalid contestants." };

  const campaign = await getCampaign();
  const before = { ...campaign };
  const beforeContestants = (await getContestants(campaign)).map((c) => ({ code: c.code, name: c.name }));

  await db.transaction(async (tx) => {
    await tx.update(schema.campaigns).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.campaigns.id, campaign.id));
    // Replace the contestant list wholesale; votes reference contestants by code, so renaming a code
    // simply hides the old code's votes (documented in the settings UI).
    await tx.delete(schema.contestants).where(eq(schema.contestants.campaignId, campaign.id));
    await tx.insert(schema.contestants).values(contestants.data.map((c, position) => ({ ...c, position, campaignId: campaign.id })));
  });

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    const prev = before[k as keyof typeof before];
    if (prev !== v) changed[k] = { from: prev, to: v };
  }
  if (JSON.stringify(beforeContestants) !== JSON.stringify(contestants.data)) changed.contestants = { from: beforeContestants, to: contestants.data };
  await audit(admin, "settings.updated", { details: changed });
  revalidateAdmin();
  return { ok: true, message: "Settings saved." };
}

// ---------- demo / live ----------

export async function resetDemoDataAction(): Promise<void> {
  const admin = await requireAdmin();
  const campaign = await getCampaign();
  const device = (await db.select().from(schema.devices).orderBy(schema.devices.id).limit(1))[0];
  if (!device) throw new Error("Create a device before loading demo data.");
  const t = await resetDemoData(campaign, device);
  await audit(admin, "campaign.demo_data_reset", { details: t });
  revalidateAdmin();
}

export async function resetScoresAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESET") return;
  const campaign = await getCampaign();
  const result = await resetScores(campaign);
  await audit(admin, "campaign.scores_reset", { details: result });
  revalidateAdmin();
}

export async function startLiveCampaignAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "GO LIVE") return;
  const campaign = await getCampaign();
  const removed = await startLiveCampaign(campaign);
  await audit(admin, "campaign.started_live", { details: { removedVotes: removed } });
  revalidateAdmin();
}
