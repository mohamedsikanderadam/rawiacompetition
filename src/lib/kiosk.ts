import { cookies } from "next/headers";
import type { Campaign, Device } from "@/db/schema";
import { countdownLabel, determineWinner, getCampaignStatus, type CampaignStatus, type Scoreboard, type Winner } from "./battle";
import { getScoreboard } from "./campaign";
import { findDeviceByToken } from "./votes";

export const KIOSK_COOKIE = "rawia_kiosk";
export const KIOSK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Resolves the kiosk device from the httpOnly cookie or an `x-kiosk-token` header. */
export async function getKioskDevice(request?: Request): Promise<Device | null> {
  const header = request?.headers.get("x-kiosk-token");
  if (header) return findDeviceByToken(header);
  const store = await cookies();
  return findDeviceByToken(store.get(KIOSK_COOKIE)?.value);
}

/** Everything the public/kiosk UI needs. Never includes secrets or admin data. */
export type PublicBattleState = {
  campaign: {
    name: string;
    startDate: string;
    endDate: string;
    a: { code: string; name: string };
    b: { code: string; name: string };
    headline: string;
    headlineAccent: string;
    subline: string;
    mode: string;
  };
  status: CampaignStatus;
  countdown: string;
  scoreboard: Scoreboard;
  winner: Winner | null;
  serverTime: string;
};

export async function buildPublicState(campaign: Campaign, now = new Date()): Promise<PublicBattleState> {
  const status = getCampaignStatus(campaign, now);
  const scoreboard = await getScoreboard(campaign);
  return {
    campaign: {
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      a: { code: campaign.universityACode, name: campaign.universityAName },
      b: { code: campaign.universityBCode, name: campaign.universityBName },
      headline: campaign.headline,
      headlineAccent: campaign.headlineAccent,
      subline: campaign.subline,
      mode: campaign.mode,
    },
    status,
    countdown: countdownLabel(status),
    scoreboard,
    winner: status.phase === "ended" ? determineWinner(scoreboard) : null,
    serverTime: now.toISOString(),
  };
}

export type KioskState = PublicBattleState & {
  device: { name: string; identifier: string; active: boolean };
  settings: {
    showScoresOnVote: boolean;
    showConfirmationScore: boolean;
    confirmationDurationMs: number;
    attractEnabled: boolean;
    attractTimeoutMs: number;
  };
};

export async function buildKioskState(campaign: Campaign, device: Device, now = new Date()): Promise<KioskState> {
  const pub = await buildPublicState(campaign, now);
  const hideScores = !campaign.showScoresOnVote && !campaign.showConfirmationScore && pub.status.phase !== "ended";
  return {
    ...pub,
    scoreboard: hideScores
      ? { ...pub.scoreboard, a: { ...pub.scoreboard.a, votes: 0, pct: 50 }, b: { ...pub.scoreboard.b, votes: 0, pct: 50 }, total: 0, leader: null, lead: 0 }
      : pub.scoreboard,
    device: { name: device.deviceName, identifier: device.deviceIdentifier, active: device.active },
    settings: {
      showScoresOnVote: campaign.showScoresOnVote,
      showConfirmationScore: campaign.showConfirmationScore,
      confirmationDurationMs: campaign.confirmationDurationMs,
      attractEnabled: campaign.attractEnabled,
      attractTimeoutMs: campaign.attractTimeoutMs,
    },
  };
}
