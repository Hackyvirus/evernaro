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
// A short timeout guards against Redis hanging the request: the shared
// connection is configured with maxRetriesPerRequest: null for BullMQ's
// sake, which would otherwise let a single slow command stall indefinitely.
const RATE_LIMIT_TIMEOUT_MS = 500;
// Fail closed by default for all security-sensitive and authenticated routes.
// Public webhook routes explicitly opt out with failClosed: false.
const FAIL_CLOSED_DEFAULT = process.env.RATE_LIMIT_FAIL_CLOSED !== "false";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Rate limit check timed out")), ms)),
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
    const count = await withTimeout(redisConnection.incr(redisKey), RATE_LIMIT_TIMEOUT_MS);
    if (count === 1) {
      await withTimeout(redisConnection.expire(redisKey, windowSeconds), RATE_LIMIT_TIMEOUT_MS);
    }
    return count <= limit;
  } catch (err) {
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(err, { tags: { context: "rate-limit" }, extra: { key, failClosed } });
    }
    console.error(`Rate limit check failed (${failClosed ? "blocking" : "allowing"} request):`, err);
    return !failClosed;
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
