/** Verify the Razorpay keys in the environment can create a subscription
 * (the exact calls changeSubscriptionPlan makes). npx tsx -r dotenv/config scripts/razorpay-probe.ts dotenv_config_path=.env */
import Razorpay from "razorpay";

const client = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

async function main() {
  console.log("key_id:", process.env.RAZORPAY_KEY_ID);
  try {
    const customer = await client.customers.create({ email: "probe@example.com", name: "Probe", notes: {} });
    console.log("customer OK:", customer.id);
    const plan = await client.plans.create({
      period: "monthly",
      interval: 1,
      item: { name: "Growth - monthly", amount: 149900, currency: "INR" },
    });
    console.log("plan OK:", plan.id);
    const now = Math.floor(Date.now() / 1000);
    const sub = await client.subscriptions.create({
      plan_id: plan.id,
      customer_id: customer.id,
      total_count: 12,
      quantity: 1,
      start_at: now + 14 * 24 * 3600,
      expire_by: now + 40 * 24 * 3600,
    } as Parameters<typeof client.subscriptions.create>[0]);
    console.log("subscription OK:", sub.id, sub.status);
    console.log("\nALL GOOD — these keys work.");
  } catch (err) {
    console.error("\nFAILED:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }
}
main().then(() => process.exit(0));
