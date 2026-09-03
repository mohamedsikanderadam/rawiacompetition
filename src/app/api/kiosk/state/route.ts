import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaign";
import { buildKioskState, getKioskDevice } from "@/lib/kiosk";

export const dynamic = "force-dynamic";

/** GET /api/kiosk/state — settings + status + scoreboard for an authorised kiosk. */
export async function GET(request: Request) {
  const device = await getKioskDevice(request);
  if (!device) {
    return NextResponse.json({ ok: false, code: "unauthorized_device" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const campaign = await getCampaign();
  const state = await buildKioskState(campaign, device);
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}
