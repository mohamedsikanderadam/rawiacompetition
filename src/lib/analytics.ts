import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Campaign } from "@/db/schema";
import type { Contestant, Totals } from "./battle";
import { getContestants } from "./campaign";
import { CAMPAIGN_TZ, addDays, daysBetween, localDateKey, localDayEnd, localDayStart } from "./time";

/** `counts` is keyed by contestant code; every configured code is present (0 when no votes). */
export type DayRow = { day: string; counts: Totals; total: number; cumulative: Totals };
export type HourRow = { hour: number; counts: Totals; total: number };
export type DeviceRow = { deviceId: number; deviceName: string; deviceIdentifier: string; active: boolean; counts: Totals; total: number };
export type PeriodTotals = { counts: Totals; total: number; leader: string | null };

export type Analytics = {
  contestants: Contestant[];
  today: PeriodTotals;
  yesterday: PeriodTotals;
  /** Percentage change of today's participation vs yesterday; null when yesterday had no votes. */
  todayVsYesterdayPct: number | null;
  averagePerDay: number;
  peakDay: DayRow | null;
  byDay: DayRow[];
  byHour: HourRow[];
  byDevice: DeviceRow[];
  daysElapsed: number;
};

function validVotes(campaign: Campaign) {
  return and(eq(schema.votes.campaignId, campaign.id), eq(schema.votes.status, "valid"));
}

function zeroCounts(contestants: Contestant[]): Totals {
  return Object.fromEntries(contestants.map((c) => [c.code, 0]));
}

/** Code of the sole top contestant, or null on a shared top spot / no votes. */
export function leaderOf(counts: Totals): string | null {
  const entries = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  if (!entries[0] || entries[0][1] === 0) return null;
  if (entries[1] && entries[1][1] === entries[0][1]) return null;
  return entries[0][0];
}

function sum(counts: Totals): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

async function totalsBetween(campaign: Campaign, contestants: Contestant[], from: Date, to: Date): Promise<PeriodTotals> {
  const rows = await db
    .select({ university: schema.votes.university, n: count() })
    .from(schema.votes)
    .where(and(validVotes(campaign), gte(schema.votes.createdAt, from), lt(schema.votes.createdAt, to)))
    .groupBy(schema.votes.university);
  const counts = zeroCounts(contestants);
  for (const r of rows) if (r.university in counts) counts[r.university] = Number(r.n);
  return { counts, total: sum(counts), leader: leaderOf(counts) };
}

export async function getAnalytics(campaign: Campaign, now: Date = new Date()): Promise<Analytics> {
  const todayKey = localDateKey(now);
  const yesterdayKey = addDays(todayKey, -1);
  const contestants = (await getContestants(campaign)).map((c) => ({ code: c.code, name: c.name }));
  const known = new Set(contestants.map((c) => c.code));

  const [today, yesterday, dayRows, hourRows, deviceRows] = await Promise.all([
    totalsBetween(campaign, contestants, localDayStart(todayKey), localDayEnd(todayKey)),
    totalsBetween(campaign, contestants, localDayStart(yesterdayKey), localDayEnd(yesterdayKey)),
    db
      .select({
        day: sql<string>`to_char(${schema.votes.createdAt} at time zone ${CAMPAIGN_TZ}, 'YYYY-MM-DD')`,
        university: schema.votes.university,
        n: count(),
      })
      .from(schema.votes)
      .where(validVotes(campaign))
      .groupBy(sql`1`, schema.votes.university)
      .orderBy(sql`1`),
    db
      .select({
        hour: sql<number>`extract(hour from ${schema.votes.createdAt} at time zone ${CAMPAIGN_TZ})::int`,
        university: schema.votes.university,
        n: count(),
      })
      .from(schema.votes)
      .where(validVotes(campaign))
      .groupBy(sql`1`, schema.votes.university),
    db
      .select({
        deviceId: schema.devices.id,
        deviceName: schema.devices.deviceName,
        deviceIdentifier: schema.devices.deviceIdentifier,
        active: schema.devices.active,
        university: schema.votes.university,
        n: count(schema.votes.id),
      })
      .from(schema.devices)
      .leftJoin(schema.votes, and(eq(schema.votes.deviceId, schema.devices.id), validVotes(campaign)))
      .groupBy(schema.devices.id, schema.votes.university)
      .orderBy(schema.devices.id),
  ]);

  // Fill every day from campaign start to today (or end date if earlier) so the chart has no gaps.
  const lastDay = todayKey < campaign.endDate ? todayKey : campaign.endDate;
  const firstDay = campaign.startDate < lastDay ? campaign.startDate : lastDay;
  const dayMap = new Map<string, Totals>();
  for (const r of dayRows) {
    if (!known.has(r.university)) continue;
    const entry = dayMap.get(r.day) ?? zeroCounts(contestants);
    entry[r.university] += Number(r.n);
    dayMap.set(r.day, entry);
  }
  const byDay: DayRow[] = [];
  const cumulative = zeroCounts(contestants);
  const pushDay = (day: string) => {
    const counts = dayMap.get(day) ?? zeroCounts(contestants);
    for (const code of known) cumulative[code] += counts[code];
    byDay.push({ day, counts, total: sum(counts), cumulative: { ...cumulative } });
  };
  const span = Math.max(0, daysBetween(firstDay, lastDay));
  for (let i = 0; i <= span; i++) pushDay(addDays(firstDay, i));
  // Include any stray votes outside the campaign window (e.g. reopened campaign) so totals reconcile.
  for (const day of dayMap.keys()) if (day < firstDay || day > lastDay) pushDay(day);
  byDay.sort((x, y) => x.day.localeCompare(y.day));

  const byHour: HourRow[] = Array.from({ length: 24 }, (_, hour) => ({ hour, counts: zeroCounts(contestants), total: 0 }));
  for (const r of hourRows) {
    const h = byHour[Number(r.hour)];
    if (!h || !known.has(r.university)) continue;
    h.counts[r.university] += Number(r.n);
    h.total = sum(h.counts);
  }

  const deviceMap = new Map<number, DeviceRow>();
  for (const r of deviceRows) {
    const d = deviceMap.get(r.deviceId) ?? {
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      deviceIdentifier: r.deviceIdentifier,
      active: r.active,
      counts: zeroCounts(contestants),
      total: 0,
    };
    if (r.university && known.has(r.university)) d.counts[r.university] += Number(r.n);
    d.total = sum(d.counts);
    deviceMap.set(r.deviceId, d);
  }

  const daysWithVotes = byDay.filter((d) => d.total > 0);
  const totalVotes = byDay.reduce((s, d) => s + d.total, 0);
  const daysElapsed = byDay.filter((d) => d.day <= todayKey && d.day >= campaign.startDate).length;
  const peakDay = daysWithVotes.reduce<DayRow | null>((best, d) => (!best || d.total > best.total ? d : best), null);

  return {
    contestants,
    today,
    yesterday,
    todayVsYesterdayPct: yesterday.total === 0 ? null : Math.round(((today.total - yesterday.total) / yesterday.total) * 100),
    averagePerDay: daysElapsed === 0 ? 0 : Math.round((totalVotes / daysElapsed) * 10) / 10,
    peakDay,
    byDay,
    byHour,
    byDevice: [...deviceMap.values()],
    daysElapsed,
  };
}
