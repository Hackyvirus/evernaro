import crypto from "crypto";
import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
});

describe("verifyRazorpayPaymentSignature", () => {
  it("accepts a correctly computed signature", async () => {
    const { verifyRazorpayPaymentSignature } = await import("./razorpay");
    const razorpayOrderId = "order_123";
    const razorpayPaymentId = "pay_456";
    const razorpaySignature = crypto
      .createHmac("sha256", "test_key_secret")
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    expect(verifyRazorpayPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { verifyRazorpayPaymentSignature } = await import("./razorpay");
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_456",
        razorpaySignature: "not-the-real-signature",
      })
    ).toBe(false);
  });

  it("rejects a signature computed for a different order/payment pair", async () => {
    const { verifyRazorpayPaymentSignature } = await import("./razorpay");
    const signatureForDifferentOrder = crypto
      .createHmac("sha256", "test_key_secret")
      .update("order_999|pay_456")
      .digest("hex");
    expect(
      verifyRazorpayPaymentSignature({
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_456",
        razorpaySignature: signatureForDifferentOrder,
      })
    ).toBe(false);
  });
});

describe("verifyRazorpayWebhookSignature", () => {
  it("accepts a correctly computed webhook signature", async () => {
    const { verifyRazorpayWebhookSignature } = await import("./razorpay");
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update(rawBody).digest("hex");
    expect(verifyRazorpayWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a missing signature", async () => {
    const { verifyRazorpayWebhookSignature } = await import("./razorpay");
    expect(verifyRazorpayWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects a body that doesn't match the signature", async () => {
    const { verifyRazorpayWebhookSignature } = await import("./razorpay");
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update("original body").digest("hex");
    expect(verifyRazorpayWebhookSignature("tampered body", signature)).toBe(false);
  });
});
