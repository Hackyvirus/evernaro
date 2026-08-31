import Razorpay from "razorpay";
import { isRazorpayConfigured } from "@/lib/razorpay";

type RazorpaySubscriptionCreateParams = {
  plan_id: string;
  customer_id?: string;
  total_count: number;
  quantity?: number;
  start_at?: number;
  expire_by?: number;
};

export function getRazorpayBillingClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

async function findRazorpayCustomerByEmail(client: Razorpay, email: string) {
  // Razorpay has no "get customer by email", so scan the (bounded) list.
  for (let skip = 0; skip < 2000; skip += 100) {
    const page = await client.customers.all({ count: 100, skip });
    const match = page.items.find((c) => c.email === email);
    if (match) return match;
    if (page.items.length < 100) break;
  }
  return null;
}

export async function createRazorpayCustomer(opts: { email: string; name: string; orgId: string }) {
  const client = getRazorpayBillingClient();
  try {
    // fail_existing: 0 asks Razorpay to return an existing customer instead of
    // erroring — but it still 400s on a duplicate email in practice (usually a
    // customer orphaned by an earlier failed subscribe attempt), so recover.
    return await client.customers.create({
      email: opts.email,
      name: opts.name,
      notes: { orgId: opts.orgId },
      fail_existing: 0,
    });
  } catch (err) {
    const existing = await findRazorpayCustomerByEmail(client, opts.email);
    if (existing) return existing;
    throw err;
  }
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
  const params: RazorpaySubscriptionCreateParams = {
    plan_id: opts.planId,
    customer_id: opts.customerId,
    total_count: opts.totalCount,
    quantity: opts.quantity ?? 1,
    start_at: opts.startAt,
    expire_by: opts.expireBy,
  };
  return client.subscriptions.create(params);
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

export async function fetchRazorpayTokens(razorpayCustomerId: string) {
  const client = getRazorpayBillingClient();
  return client.customers.fetchTokens(razorpayCustomerId) as unknown as Promise<
    Array<{
      id: string;
      entity: string;
      token: string;
      bank?: string;
      wallet?: string;
      vpa?: string;
      card?: {
        last4: string;
        network: string;
        type: string;
        issuer?: string;
      };
      status: string;
      recurring?: string;
    }>
  >;
}

export async function deleteRazorpayToken(razorpayCustomerId: string, tokenId: string) {
  const client = getRazorpayBillingClient();
  return client.customers.deleteToken(razorpayCustomerId, tokenId);
}
