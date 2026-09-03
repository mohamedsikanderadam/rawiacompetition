import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Campaign } from "@/db/schema";
import { CAMPAIGN_TZ, addDays, daysBetween, localDateKey, localDayEnd, localDayStart } from "./time";

export type DayRow = { day: string; a: number; b: number; total: number; cumulativeA: number; cumulativeB: number };
export type HourRow = { hour: number; a: number; b: number; total: number };
export type DeviceRow = { deviceId: number; deviceName: string; deviceIdentifier: string; active: boolean; a: number; b: number; total: number };

export type Analytics = {
  today: { a: number; b: number; total: number; leader: string | null };
  yesterday: { a: number; b: number; total: number };
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

async function totalsBetween(campaign: Campaign, from: Date, to: Date) {
  const rows = await db
    .select({ university: schema.votes.university, n: count() })
    .from(schema.votes)
    .where(and(validVotes(campaign), gte(schema.votes.createdAt, from), lt(schema.votes.createdAt, to)))
    .groupBy(schema.votes.university);
  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (r.university === campaign.universityACode) a = Number(r.n);
    if (r.university === campaign.universityBCode) b = Number(r.n);
  }
  return { a, b, total: a + b };
}

export async function getAnalytics(campaign: Campaign, now: Date = new Date()): Promise<Analytics> {
  const todayKey = localDateKey(now);
  const yesterdayKey = addDays(todayKey, -1);

  const [today, yesterday, dayRows, hourRows, deviceRows] = await Promise.all([
    totalsBetween(campaign, localDayStart(todayKey), localDayEnd(todayKey)),
    totalsBetween(campaign, localDayStart(yesterdayKey), localDayEnd(yesterdayKey)),
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
  const dayMap = new Map<string, { a: number; b: number }>();
  for (const r of dayRows) {
    const entry = dayMap.get(r.day) ?? { a: 0, b: 0 };
    if (r.university === campaign.universityACode) entry.a += Number(r.n);
    if (r.university === campaign.universityBCode) entry.b += Number(r.n);
    dayMap.set(r.day, entry);
  }
  const byDay: DayRow[] = [];
  let cumA = 0;
  let cumB = 0;
  const span = Math.max(0, daysBetween(firstDay, lastDay));
  for (let i = 0; i <= span; i++) {
    const day = addDays(firstDay, i);
    const e = dayMap.get(day) ?? { a: 0, b: 0 };
    cumA += e.a;
    cumB += e.b;
    byDay.push({ day, a: e.a, b: e.b, total: e.a + e.b, cumulativeA: cumA, cumulativeB: cumB });
  }
  // Include any stray votes outside the campaign window (e.g. reopened campaign) so totals reconcile.
  for (const [day, e] of dayMap) {
    if (day < firstDay || day > lastDay) {
      cumA += e.a;
      cumB += e.b;
      byDay.push({ day, a: e.a, b: e.b, total: e.a + e.b, cumulativeA: cumA, cumulativeB: cumB });
    }
  }
  byDay.sort((x, y) => x.day.localeCompare(y.day));

  const byHour: HourRow[] = Array.from({ length: 24 }, (_, hour) => ({ hour, a: 0, b: 0, total: 0 }));
  for (const r of hourRows) {
    const h = byHour[Number(r.hour)];
    if (!h) continue;
    if (r.university === campaign.universityACode) h.a += Number(r.n);
    if (r.university === campaign.universityBCode) h.b += Number(r.n);
    h.total = h.a + h.b;
  }

  const deviceMap = new Map<number, DeviceRow>();
  for (const r of deviceRows) {
    const d = deviceMap.get(r.deviceId) ?? {
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      deviceIdentifier: r.deviceIdentifier,
      active: r.active,
      a: 0,
      b: 0,
      total: 0,
    };
    if (r.university === campaign.universityACode) d.a += Number(r.n);
    if (r.university === campaign.universityBCode) d.b += Number(r.n);
    d.total = d.a + d.b;
    deviceMap.set(r.deviceId, d);
  }

  const daysWithVotes = byDay.filter((d) => d.total > 0);
  const totalVotes = byDay.reduce((s, d) => s + d.total, 0);
  const daysElapsed = byDay.filter((d) => d.day <= todayKey && d.day >= campaign.startDate).length;
  const peakDay = daysWithVotes.reduce<DayRow | null>((best, d) => (!best || d.total > best.total ? d : best), null);

  return {
    today: {
      ...today,
      leader: today.a === today.b ? null : today.a > today.b ? campaign.universityACode : campaign.universityBCode,
    },
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
