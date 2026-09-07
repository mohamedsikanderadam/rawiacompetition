import type { Campaign } from "@/db/schema";
import { daysBetween, localDateKey, localDayEnd, localDayStart } from "./time";

export const MIN_CONTESTANTS = 2;
export const MAX_CONTESTANTS = 6;

export type Contestant = { code: string; name: string };

/** Valid-vote count per contestant code. */
export type Totals = Record<string, number>;

export type ScoreEntry = Contestant & { votes: number; pct: number };

export type Scoreboard = {
  /** In configured display order. */
  entries: ScoreEntry[];
  total: number;
  /** Code of the sole leader, or null when the top spot is shared. */
  leader: string | null;
  /** Gap between first and second place. */
  lead: number;
};

/** Pure leaderboard calculation from counted valid votes. */
export function buildScoreboard(contestants: Contestant[], totals: Totals): Scoreboard {
  const counts = contestants.map((c) => totals[c.code] ?? 0);
  const total = counts.reduce((s, n) => s + n, 0);
  const n = contestants.length;
  // Percentages round to 0.1 and are adjusted so they always sum to exactly 100.
  let pcts = total === 0 ? counts.map(() => Math.round((1000 / n)) / 10) : counts.map((c) => Math.round((c / total) * 1000) / 10);
  const drift = Math.round((100 - pcts.reduce((s, p) => s + p, 0)) * 10) / 10;
  if (drift !== 0 && pcts.length) {
    const i = counts.indexOf(Math.max(...counts));
    pcts = pcts.map((p, j) => (j === i ? Math.round((p + drift) * 10) / 10 : p));
  }
  const sorted = [...counts].sort((x, y) => y - x);
  const first = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  const leader = first > second ? contestants[counts.indexOf(first)].code : null;
  return {
    entries: contestants.map((c, i) => ({ code: c.code, name: c.name, votes: counts[i], pct: pcts[i] })),
    total,
    leader,
    lead: first - second,
  };
}

/** Entries sorted by votes (desc), stable on display order. */
export function rankEntries(board: Scoreboard): ScoreEntry[] {
  return [...board.entries].sort((x, y) => y.votes - x.votes);
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

export type Winner = { code: string; name: string; margin: number } | { tie: true; margin: 0; codes: string[] };

export function determineWinner(board: Scoreboard): Winner {
  const ranked = rankEntries(board);
  const top = ranked[0];
  if (!top || !board.leader) {
    const max = top?.votes ?? 0;
    return { tie: true, margin: 0, codes: ranked.filter((e) => e.votes === max).map((e) => e.code) };
  }
  return { code: top.code, name: top.name, margin: board.lead };
}

export function isValidContestant(contestants: Contestant[], code: string): boolean {
  return contestants.some((c) => c.code === code);
}
