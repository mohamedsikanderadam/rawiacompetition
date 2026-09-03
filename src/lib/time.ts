/**
 * Time helpers. The campaign runs in Rawia's local time zone (Asia/Dubai by default),
 * so "today", "days left" and the campaign end are all computed in that zone.
 */
export const CAMPAIGN_TZ = process.env.CAMPAIGN_TIMEZONE || "Asia/Dubai";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPAIGN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns YYYY-MM-DD for `date` in the campaign time zone. */
export function localDateKey(date: Date = new Date()): string {
  return ymdFormatter.format(date);
}

/** Offset (ms) of the campaign zone from UTC at the given instant. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPAIGN_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant at which local midnight starts for the given YYYY-MM-DD in the campaign zone. */
export function localDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const offset = tzOffsetMs(guess);
  const first = new Date(guess.getTime() - offset);
  // Re-check in case the offset differs at the resulting instant (DST edge cases).
  const offset2 = tzOffsetMs(first);
  return offset2 === offset ? first : new Date(guess.getTime() - offset2);
}

/** First instant after the end of the given local day (i.e. start of the next day). */
export function localDayEnd(ymd: string): Date {
  return localDayStart(addDays(ymd, 1));
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromYmd` to `toYmd` (positive when `to` is later). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function formatLocalDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPAIGN_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatLocalDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPAIGN_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPAIGN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatYmdLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
