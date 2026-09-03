import type { Campaign } from "@/db/schema";
import { daysBetween, localDateKey, localDayEnd, localDayStart } from "./time";

export type UniversityInfo = { code: string; name: string };

export type Totals = { a: number; b: number };

export type Scoreboard = {
  a: UniversityInfo & { votes: number; pct: number };
  b: UniversityInfo & { votes: number; pct: number };
  total: number;
  /** Code of the leader, or null when tied. */
  leader: string | null;
  lead: number;
};

/** Pure leaderboard calculation from counted valid votes. */
export function buildScoreboard(campaign: Pick<Campaign, "universityACode" | "universityAName" | "universityBCode" | "universityBName">, totals: Totals): Scoreboard {
  const total = totals.a + totals.b;
  const pctA = total === 0 ? 50 : Math.round((totals.a / total) * 1000) / 10;
  const pctB = total === 0 ? 50 : Math.round((100 - pctA) * 10) / 10;
  const lead = Math.abs(totals.a - totals.b);
  const leader = totals.a === totals.b ? null : totals.a > totals.b ? campaign.universityACode : campaign.universityBCode;
  return {
    a: { code: campaign.universityACode, name: campaign.universityAName, votes: totals.a, pct: pctA },
    b: { code: campaign.universityBCode, name: campaign.universityBName, votes: totals.b, pct: pctB },
    total,
    leader,
    lead,
  };
}

export type CampaignPhase = "upcoming" | "live" | "paused" | "ended";

export type CampaignStatus = {
  phase: CampaignPhase;
  /** True only when votes are currently accepted. */
  acceptingVotes: boolean;
  daysLeft: number;
  /** Escalating intensity for the countdown UI. */
  urgency: "normal" | "final-week" | "final-3" | "final-day";
  startsAt: string;
  endsAt: string;
};

export function getCampaignStatus(campaign: Campaign, now: Date = new Date()): CampaignStatus {
  const startsAt = localDayStart(campaign.startDate);
  const endsAt = localDayEnd(campaign.endDate);
  const today = localDateKey(now);
  const daysLeft = Math.max(0, daysBetween(today, campaign.endDate));

  let phase: CampaignPhase;
  if (!campaign.active) phase = "paused";
  else if (now >= endsAt && !campaign.reopened) phase = "ended";
  else if (now < startsAt) phase = "upcoming";
  else phase = "live";

  let urgency: CampaignStatus["urgency"] = "normal";
  if (phase !== "ended") {
    if (daysLeft <= 0) urgency = "final-day";
    else if (daysLeft <= 3) urgency = "final-3";
    else if (daysLeft <= 7) urgency = "final-week";
  }

  return {
    phase,
    acceptingVotes: phase === "live",
    daysLeft,
    urgency,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export function countdownLabel(status: CampaignStatus): string {
  if (status.phase === "ended") return "THE BATTLE IS OVER";
  if (status.phase === "upcoming") return "COMING SOON";
  switch (status.urgency) {
    case "final-day":
      return "🚨 FINAL DAY";
    case "final-3":
      return `🚨 ${status.daysLeft} DAYS LEFT`;
    case "final-week":
      return `🔥 ${status.daysLeft} DAYS LEFT`;
    default:
      return `${status.daysLeft} DAYS LEFT`;
  }
}

export type Winner = { code: string; name: string; margin: number } | { tie: true; margin: 0 };

export function determineWinner(board: Scoreboard): Winner {
  if (board.a.votes === board.b.votes) return { tie: true, margin: 0 };
  const w = board.a.votes > board.b.votes ? board.a : board.b;
  return { code: w.code, name: w.name, margin: board.lead };
}

export function isValidUniversity(campaign: Pick<Campaign, "universityACode" | "universityBCode">, code: string): boolean {
  return code === campaign.universityACode || code === campaign.universityBCode;
}
