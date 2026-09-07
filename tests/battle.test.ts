import { describe, expect, it } from "vitest";
import type { Campaign } from "@/db/schema";
import { buildScoreboard, countdownLabel, determineWinner, getCampaignStatus, isValidContestant, rankEntries, type Contestant } from "@/lib/battle";
import { localDateKey, localDayEnd, localDayStart } from "@/lib/time";

const base: Campaign = {
  id: 1,
  name: "Rawia University Battle",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  headline: "Who runs",
  headlineAccent: "the campus?",
  subline: "One tap for your university.",
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

const two: Contestant[] = [
  { code: "UOS", name: "University of Sharjah" },
  { code: "AUS", name: "American University of Sharjah" },
];
const four: Contestant[] = [...two, { code: "AUD", name: "American University in Dubai" }, { code: "ZU", name: "Zayed University" }];

describe("scoreboard", () => {
  it("calculates totals, percentages, leader and lead", () => {
    const b = buildScoreboard(two, { UOS: 327, AUS: 294 });
    expect(b.total).toBe(621);
    expect(b.entries.map((e) => e.pct)).toEqual([52.7, 47.3]);
    expect(b.leader).toBe("UOS");
    expect(b.lead).toBe(33);
  });

  it("handles AUS lead, ties and empty boards", () => {
    expect(buildScoreboard(two, { UOS: 10, AUS: 12 }).leader).toBe("AUS");
    const tie = buildScoreboard(two, { UOS: 5, AUS: 5 });
    expect(tie.leader).toBeNull();
    expect(tie.lead).toBe(0);
    const empty = buildScoreboard(two, {});
    expect(empty.entries.map((e) => e.pct)).toEqual([50, 50]);
    expect(empty.leader).toBeNull();
  });

  it("determines winners without ever picking one on a tie", () => {
    expect(determineWinner(buildScoreboard(two, { UOS: 1284, AUS: 1197 }))).toEqual({ code: "UOS", name: two[0].name, margin: 87 });
    expect(determineWinner(buildScoreboard(two, { UOS: 100, AUS: 150 }))).toEqual({ code: "AUS", name: two[1].name, margin: 50 });
    expect(determineWinner(buildScoreboard(two, { UOS: 7, AUS: 7 }))).toEqual({ tie: true, margin: 0, codes: ["UOS", "AUS"] });
  });

  it("supports 3–6 contestants: order, percentages summing to 100, leader vs 2nd place", () => {
    const b = buildScoreboard(four, { UOS: 40, AUS: 25, AUD: 25, ZU: 10, GHOST: 99 });
    expect(b.entries.map((e) => e.code)).toEqual(["UOS", "AUS", "AUD", "ZU"]);
    expect(b.total).toBe(100);
    expect(b.entries.map((e) => e.pct)).toEqual([40, 25, 25, 10]);
    expect(b.leader).toBe("UOS");
    expect(b.lead).toBe(15);
    expect(rankEntries(b).map((e) => e.code)).toEqual(["UOS", "AUS", "AUD", "ZU"]);

    const thirds = buildScoreboard(four.slice(0, 3), { UOS: 1, AUS: 1, AUD: 1 });
    expect(thirds.entries.reduce((s, e) => s + e.pct, 0)).toBeCloseTo(100, 5);
    const empty = buildScoreboard(four.slice(0, 3), {});
    expect(empty.entries.reduce((s, e) => s + e.pct, 0)).toBeCloseTo(100, 5);
  });

  it("reports multi-way ties at the top", () => {
    const b = buildScoreboard(four, { UOS: 30, AUS: 30, AUD: 30, ZU: 10 });
    expect(b.leader).toBeNull();
    expect(determineWinner(b)).toEqual({ tie: true, margin: 0, codes: ["UOS", "AUS", "AUD"] });
    const w = determineWinner(buildScoreboard(four, { UOS: 5, AUS: 9, AUD: 30, ZU: 10 }));
    expect(w).toEqual({ code: "AUD", name: "American University in Dubai", margin: 20 });
  });

  it("validates contestant codes against the configured list", () => {
    expect(isValidContestant(four, "ZU")).toBe(true);
    expect(isValidContestant(four, "MIT")).toBe(false);
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
