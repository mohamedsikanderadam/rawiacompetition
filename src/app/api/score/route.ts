import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign";
import { buildPublicState } from "@/lib/kiosk";

export const dynamic = "force-dynamic";

/** GET /api/score — read-only public competition status (used by /battle). */
export async function GET() {
  const campaign = await getCampaign();
  const state = await buildPublicState(campaign);
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}
