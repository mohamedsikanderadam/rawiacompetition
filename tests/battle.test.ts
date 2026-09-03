import { describe, expect, it } from "vitest";
import type { Campaign } from "@/db/schema";
import { buildScoreboard, countdownLabel, determineWinner, getCampaignStatus } from "@/lib/battle";
import { localDateKey, localDayEnd, localDayStart } from "@/lib/time";

const base: Campaign = {
  id: 1,
  name: "Rawia University Battle",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  universityACode: "UOS",
  universityAName: "University of Sharjah",
  universityBCode: "AUS",
  universityBName: "American University of Sharjah",
  active: true,
  reopened: false,
  showScoresOnVote: true,
  showConfirmationScore: true,
  confirmationDurationMs: 2500,
  attractEnabled: true,
  attractTimeoutMs: 45000,
  mode: "live",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Asia/Dubai is UTC+4. 2026-09-03 14:32 Dubai = 10:32Z.
const dubai = (ymdHm: string) => new Date(`${ymdHm}:00+04:00`);

describe("scoreboard", () => {
  it("calculates totals, percentages, leader and lead", () => {
    const b = buildScoreboard(base, { a: 327, b: 294 });
    expect(b.total).toBe(621);
    expect(b.a.pct).toBe(52.7);
    expect(b.b.pct).toBe(47.3);
    expect(b.leader).toBe("UOS");
    expect(b.lead).toBe(33);
  });

  it("handles AUS lead, ties and empty boards", () => {
    expect(buildScoreboard(base, { a: 10, b: 12 }).leader).toBe("AUS");
    const tie = buildScoreboard(base, { a: 5, b: 5 });
    expect(tie.leader).toBeNull();
    expect(tie.lead).toBe(0);
    const empty = buildScoreboard(base, { a: 0, b: 0 });
    expect(empty.a.pct).toBe(50);
    expect(empty.leader).toBeNull();
  });

  it("determines winners without ever picking one on a tie", () => {
    expect(determineWinner(buildScoreboard(base, { a: 1284, b: 1197 }))).toEqual({ code: "UOS", name: base.universityAName, margin: 87 });
    expect(determineWinner(buildScoreboard(base, { a: 100, b: 150 }))).toEqual({ code: "AUS", name: base.universityBName, margin: 50 });
    expect(determineWinner(buildScoreboard(base, { a: 7, b: 7 }))).toEqual({ tie: true, margin: 0 });
  });
});

describe("campaign status & countdown", () => {
  it("is live during September and counts days left in Dubai time", () => {
    const s = getCampaignStatus(base, dubai("2026-09-03T14:32"));
    expect(s.phase).toBe("live");
    expect(s.acceptingVotes).toBe(true);
    expect(s.daysLeft).toBe(27);
    expect(countdownLabel(s)).toBe("27 DAYS LEFT");
  });

  it("escalates urgency in the final week, final 3 days and final day", () => {
    expect(countdownLabel(getCampaignStatus(base, dubai("2026-09-23T10:00")))).toBe("🔥 7 DAYS LEFT");
    expect(countdownLabel(getCampaignStatus(base, dubai("2026-09-27T10:00")))).toBe("🚨 3 DAYS LEFT");
    expect(countdownLabel(getCampaignStatus(base, dubai("2026-09-30T10:00")))).toBe("🚨 FINAL DAY");
  });

  it("closes automatically at Dubai midnight after the end date", () => {
    expect(getCampaignStatus(base, dubai("2026-09-30T23:59")).phase).toBe("live");
    const ended = getCampaignStatus(base, dubai("2026-10-01T00:00"));
    expect(ended.phase).toBe("ended");
    expect(ended.acceptingVotes).toBe(false);
    expect(countdownLabel(ended)).toBe("THE BATTLE IS OVER");
  });

  it("respects pause, upcoming and manual reopen", () => {
    expect(getCampaignStatus({ ...base, active: false }, dubai("2026-09-10T10:00")).phase).toBe("paused");
    expect(getCampaignStatus(base, dubai("2026-08-31T23:00")).phase).toBe("upcoming");
    expect(getCampaignStatus({ ...base, reopened: true }, dubai("2026-10-02T10:00")).phase).toBe("live");
  });
});

describe("time helpers", () => {
  it("maps instants to Dubai calendar days", () => {
    expect(localDateKey(new Date("2026-09-03T21:30:00Z"))).toBe("2026-09-04");
    expect(localDayStart("2026-09-01").toISOString()).toBe("2026-08-31T20:00:00.000Z");
    expect(localDayEnd("2026-09-30").toISOString()).toBe("2026-09-30T20:00:00.000Z");
  });
});
