// MandateSeal rate limiter — in-memory sliding window with LRU eviction.
//
// Sized for one Vercel function instance at a time (no shared state across
// instances). Sufficient for casual abuse protection; for adversarial load,
// swap the bucket store for Upstash Redis behind the same `checkRateLimit`
// interface. Hot path stays O(1) amortized.
//
// Buckets are evicted when:
//   (a) all hits in the bucket have aged past the window, or
//   (b) the global bucket count exceeds MAX_BUCKETS — oldest-touched dropped.

interface Bucket {
  hits: number[];
  lastTouched: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
}

function evictIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  // Map iterates in insertion order; with Map.set on touch we'd need to
  // re-insert. Cheaper: snapshot keys, sort by lastTouched, drop oldest 10%.
  const entries = Array.from(buckets.entries());
  entries.sort((a, b) => a[1].lastTouched - b[1].lastTouched);
  const dropCount = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < dropCount; i++) buckets.delete(entries[i][0]);
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], lastTouched: now };
    buckets.set(key, bucket);
    evictIfNeeded();
  }
  bucket.lastTouched = now;

  // Drop expired hits in place. Array stays small (bounded by opts.limit).
  if (bucket.hits.length > 0 && bucket.hits[0] <= cutoff) {
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
  }

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, opts.windowMs - (now - oldest)),
      limit: opts.limit,
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: opts.limit - bucket.hits.length,
    retryAfterMs: 0,
    limit: opts.limit,
  };
}

/** Reset everything — test-only helper. */
export function _resetRateLimitState() {
  buckets.clear();
}

/**
 * Best-effort client IP extraction for Vercel.
 * Falls back to "unknown" so the bucket key is always defined — the limit then
 * acts as a global cap, which is the safer failure mode.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Vercel sets x-forwarded-for to the client IP only (no chain), but be
    // defensive in case a CDN prepends entries.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Build a NextResponse-compatible 429 body + headers when a limit is hit.
 */
export function rateLimitResponse(result: RateLimitResult): {
  body: { error: string; retryAfterMs: number; limit: number };
  init: { status: number; headers: Record<string, string> };
} {
  return {
    body: {
      error: "Rate limit exceeded",
      retryAfterMs: result.retryAfterMs,
      limit: result.limit,
    },
    init: {
      status: 429,
      headers: {
        "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
      },
    },
  };
}
