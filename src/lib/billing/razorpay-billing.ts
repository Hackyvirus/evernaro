import "server-only";
import Razorpay from "razorpay";
import { isRazorpayConfigured } from "@/lib/razorpay";

export function getRazorpayBillingClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

export async function createRazorpayCustomer(opts: { email: string; name: string; orgId: string }) {
  const client = getRazorpayBillingClient();
  return client.customers.create({
    email: opts.email,
    name: opts.name,
    notes: { orgId: opts.orgId },
  });
}

export async function createRazorpayPlan(opts: {
  period: "monthly" | "yearly";
  interval: number;
  amountInr: number;
  name: string;
}) {
  const client = getRazorpayBillingClient();
  return client.plans.create({
    period: opts.period,
    interval: opts.interval,
    item: {
      name: opts.name,
      amount: opts.amountInr * 100,
      currency: "INR",
    },
  });
}

export async function createRazorpaySubscription(opts: {
  planId: string;
  customerId: string;
  totalCount: number;
  quantity?: number;
  startAt?: number;
  expireBy?: number;
}) {
  const client = getRazorpayBillingClient();
  return client.subscriptions.create({
    plan_id: opts.planId,
    customer_id: opts.customerId,
    total_count: opts.totalCount,
    quantity: opts.quantity ?? 1,
    start_at: opts.startAt,
    expire_by: opts.expireBy,
  });
}

export async function cancelRazorpaySubscription(razorpaySubscriptionId: string, cancelAtEnd: boolean) {
  const client = getRazorpayBillingClient();
  return client.subscriptions.cancel(razorpaySubscriptionId, cancelAtEnd);
}

export async function updateRazorpaySubscriptionQuantity(razorpaySubscriptionId: string, quantity: number) {
  const client = getRazorpayBillingClient();
  return client.subscriptions.update(razorpaySubscriptionId, { quantity });
}

export async function fetchRazorpaySubscription(razorpaySubscriptionId: string) {
  const client = getRazorpayBillingClient();
  return client.subscriptions.fetch(razorpaySubscriptionId);
}
