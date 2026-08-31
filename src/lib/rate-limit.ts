import { redisConnection } from "@/lib/redis";

// Fixed-window rate limit backed by the same Redis instance BullMQ already
// uses. By default it fails OPEN on any Redis error (a slow/unreachable Redis
// should never take down signup or inbound webhooks) — but that failure is
// still worth knowing about, so it's reported to Sentry rather than silently
// swallowed.
//
// Set RATE_LIMIT_FAIL_CLOSED=true in production to block sensitive public
// endpoints (auth, signup, contact, chat, public booking/queue/review) when
// Redis is unavailable. Public webhook routes (WhatsApp/Telegram/Instagram)
// intentionally remain fail-open even in that mode: they pass failClosed:false
// and return { ok: true } instead of 429 so provider retries don't cause
// outages.
//
// A timeout guards against Redis hanging the request: the shared connection
// is configured with maxRetriesPerRequest: null for BullMQ's sake, which
// would otherwise let a single slow command stall indefinitely. It must be
// generous enough to cover a cold serverless invocation's first TLS connect
// to a remote Redis — 500ms was tripping constantly on Vercel cold starts
// and, combined with failClosed, hard-429'd every signup/login.
const RATE_LIMIT_TIMEOUT_MS = 1500;
const TIMEOUT_MESSAGE = "Rate limit check timed out";
// Fail closed by default for all security-sensitive and authenticated routes.
// Public webhook routes explicitly opt out with failClosed: false.
const FAIL_CLOSED_DEFAULT = process.env.RATE_LIMIT_FAIL_CLOSED !== "false";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), ms)),
  ]);
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  { failClosed = FAIL_CLOSED_DEFAULT }: { failClosed?: boolean } = {}
): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  try {
    // INCR and EXPIRE run in one multi so a key can never end up incremented
    // without a TTL — a prior version set the TTL only when count === 1 in a
    // separate round-trip, and if that second call ever failed or timed out,
    // the counter was left permanent (ttl -1), locking the account/IP out
    // until someone manually cleared Redis. Renewing the TTL on every hit
    // (not just the first) means an ongoing attack extends its own lockout
    // window instead of racing a fixed reset, which is the safer default here.
    const results = await withTimeout(
      redisConnection.multi().incr(redisKey).expire(redisKey, windowSeconds).exec(),
      RATE_LIMIT_TIMEOUT_MS
    );
    if (!results) throw new Error("Rate limit transaction returned no results");
    const [[incrErr, count]] = results;
    if (incrErr) throw incrErr;
    return (count as number) <= limit;
  } catch (err) {
    // A timeout is an infra hiccup (usually a cold-start connect), never
    // evidence of abuse — always fail open on it, even for failClosed routes.
    // A hard Redis error (connection refused, etc.) still honours failClosed
    // so auth/signup err safe when Redis is genuinely down.
    const isTimeout = err instanceof Error && err.message === TIMEOUT_MESSAGE;
    const allow = isTimeout ? true : !failClosed;
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(err, { tags: { context: "rate-limit" }, extra: { key, failClosed, allow } });
    }
    console.error(`Rate limit check failed (${allow ? "allowing" : "blocking"} request):`, err);
    return allow;
  }
}

// Best-effort client IP for rate-limiting unauthenticated routes. Not
// spoof-proof (a client can set X-Forwarded-For itself unless the host
// strips/overwrites it), but good enough as a coarse abuse guard rather than
// a security boundary — the real protection for webhooks is their per-channel
// secret, not this.
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
