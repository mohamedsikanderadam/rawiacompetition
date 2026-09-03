import { NextResponse } from "next/server";
import { z } from "zod";
import { KIOSK_COOKIE, KIOSK_COOKIE_MAX_AGE } from "@/lib/kiosk";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findDeviceByToken } from "@/lib/votes";

export const dynamic = "force-dynamic";

/**
 * POST /api/kiosk/register — staff enters the device token once on the kiosk.
 * On success the token is stored in an httpOnly cookie so it never touches page JS again.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`kiosk-register:${clientIp(request.headers)}`, 10, 15 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, message: "Too many attempts. Try again later." }, { status: 429 });

  let token: string;
  try {
    token = z.object({ token: z.string().min(16).max(200) }).parse(await request.json()).token.trim();
  } catch {
    return NextResponse.json({ ok: false, message: "Enter the device token." }, { status: 400 });
  }

  const device = await findDeviceByToken(token);
  if (!device) return NextResponse.json({ ok: false, message: "Unknown device token." }, { status: 401 });
  if (!device.active) return NextResponse.json({ ok: false, message: "This device has been deactivated." }, { status: 403 });

  const res = NextResponse.json({ ok: true, device: { name: device.deviceName, identifier: device.deviceIdentifier } });
  res.cookies.set(KIOSK_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: KIOSK_COOKIE_MAX_AGE,
  });
  return res;
}

/** DELETE /api/kiosk/register — forget this kiosk's token (staff action). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(KIOSK_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
