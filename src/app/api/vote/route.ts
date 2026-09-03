import { NextResponse } from "next/server";
import { z } from "zod";
import { getCampaign, getScoreboard } from "@/lib/campaign";
import { getKioskDevice } from "@/lib/kiosk";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { castVote } from "@/lib/votes";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  university: z.string().min(1).max(16),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  clientVoteId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
});

const STATUS_BY_CODE = {
  campaign_inactive: 423,
  campaign_ended: 410,
  campaign_not_started: 425,
  device_inactive: 403,
  invalid_university: 400,
  too_fast: 409,
  invalid_input: 400,
} as const;

/**
 * POST /api/vote — records one vote from an authorised kiosk.
 * Auth: `rawia_kiosk` httpOnly cookie (set via /api/kiosk/register) or `x-kiosk-token` header.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`vote:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests." }, { status: 429 });
  }

  const device = await getKioskDevice(request);
  if (!device) {
    return NextResponse.json({ ok: false, code: "unauthorized_device", message: "This device is not an authorised Rawia kiosk." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "Invalid request." }, { status: 400 });
  }

  const campaign = await getCampaign();
  const result = await castVote({ campaign, device, ...body });
  if (!result.ok) {
    return NextResponse.json(result, { status: STATUS_BY_CODE[result.code] });
  }

  const scoreboard = await getScoreboard(campaign);
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    vote: { id: result.vote.id, university: result.vote.university, createdAt: result.vote.createdAt.toISOString() },
    scoreboard,
  });
}
