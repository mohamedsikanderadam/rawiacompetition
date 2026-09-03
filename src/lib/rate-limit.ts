/**
 * Small in-memory sliding-window rate limiter. Suitable for a single-instance
 * deployment (one kiosk, one admin). Swap for Redis if you scale horizontally.
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return { ok: false, retryAfterMs: windowMs - (now - bucket.hits[0]) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterMs: 0 };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : headers.get("x-real-ip")) || "unknown";
}
