import { redisConnection } from "@/lib/redis";

// Fixed-window rate limit backed by the same Redis instance BullMQ already
// uses. Fails OPEN on any Redis error (a slow/unreachable Redis should never
// take down signup or inbound webhooks) — but that failure is still worth
// knowing about, so it's reported to Sentry rather than silently swallowed.
//
// A short timeout guards against Redis hanging the request: the shared
// connection is configured with maxRetriesPerRequest: null for BullMQ's
// sake, which would otherwise let a single slow command stall indefinitely.
const RATE_LIMIT_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Rate limit check timed out")), ms)),
  ]);
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
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
      Sentry.captureException(err, { tags: { context: "rate-limit" }, extra: { key } });
    }
    console.error("Rate limit check failed, allowing request:", err);
    return true;
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
