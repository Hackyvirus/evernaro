import crypto from "crypto";

function getAuthSecret(): string {
  const key = process.env.AUTH_SECRET;
  if (!key) {
    throw new Error(
      "AUTH_SECRET is required but not set. Generate one with `npm run secrets` and add it to your environment."
    );
  }
  return key;
}

// Per-channel webhook secret derived from AUTH_SECRET — lets inbound webhook
// URLs (Telegram, WhatsApp/Gupshup) be verified without a separate secrets table.
export function channelWebhookSecret(channelId: string) {
  const key = getAuthSecret();
  return crypto.createHmac("sha256", key).update(channelId).digest("hex").slice(0, 32);
}

// Constant-time string comparison for webhook secrets — a plain `===` leaks
// timing information proportional to how many leading characters match.
export function secureCompare(a: string | null, b: string): boolean {
  if (!a) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
