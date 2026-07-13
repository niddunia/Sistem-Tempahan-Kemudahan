/**
 * In-memory rate limiter for Sistem e-Tempahan PLTT-JTM
 * Brute-force mitigation on auth endpoints (PDPA / ICT Security best practice).
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically purge expired buckets to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt < now) buckets.delete(k);
  }
}, 60_000).unref();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * @param key     Unique key (e.g. `${ip}:${route}`)
 * @param limit   Max requests in window
 * @param windowMs Window size in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterMs: 0,
  };
}
