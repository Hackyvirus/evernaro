import crypto from "crypto";
import Razorpay from "razorpay";

// One-time-payment-per-invoice via Razorpay's Orders + Checkout — not the
// Subscriptions product, which needs a Plan pre-created in the Razorpay
// dashboard (needs a live account to set up). This works the moment
// RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set; everything else no-ops
// safely without them, same pattern as Sentry.

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function createRazorpayOrder(opts: { amountInr: number; receipt: string }) {
  const client = getClient();
  return client.orders.create({
    amount: opts.amountInr * 100, // Razorpay wants paise, not rupees
    currency: "INR",
    receipt: opts.receipt,
  });
}

// Verifies the signature Razorpay Checkout returns to the browser on a
// successful payment — HMAC-SHA256 of "order_id|payment_id" using the key
// secret. This is the client-side confirmation path; the webhook below is
// the durable, server-to-server source of truth in case the browser never
// gets to report back (tab closed, network drop after paying).
export function verifyRazorpayPaymentSignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${opts.razorpayOrderId}|${opts.razorpayPaymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, opts.razorpaySignature);
}

// Verifies the signature on incoming webhook requests — HMAC-SHA256 of the
// raw request body using the separate webhook secret configured in the
// Razorpay dashboard (not the API key secret).
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
