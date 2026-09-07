import { cookies } from "next/headers";
import type { Campaign, Device } from "@/db/schema";
import { countdownLabel, determineWinner, getCampaignStatus, type CampaignStatus, type Contestant, type Scoreboard, type Winner } from "./battle";
import { getContestants, getScoreboard } from "./campaign";
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
    /** 2–6 contestants in display order. */
    contestants: Contestant[];
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
  const contestants = (await getContestants(campaign)).map((c) => ({ code: c.code, name: c.name }));
  const scoreboard = await getScoreboard(campaign, contestants);
  return {
    campaign: {
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      contestants,
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
      ? {
          ...pub.scoreboard,
          entries: pub.scoreboard.entries.map((e) => ({ ...e, votes: 0, pct: Math.round(1000 / pub.scoreboard.entries.length) / 10 })),
          total: 0,
          leader: null,
          lead: 0,
        }
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
