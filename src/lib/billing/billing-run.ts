"server-only";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { logBillingEvent } from "./events";

const DUNNING_RETRY_DAYS = [1, 3, 7];
const MAX_DUNNING_ATTEMPTS = DUNNING_RETRY_DAYS.length;

export async function createInvoiceForSubscriptionPeriod(subscriptionId: string) {
  const subscription = await prisma.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, items: { include: { addOn: true } }, org: true },
  });
  if (!subscription) throw new Error("Subscription not found");
  if (subscription.totalAmountInr <= 0) return null;

  const periodStart = subscription.currentPeriodStart ?? new Date();
  const periodEnd = subscription.currentPeriodEnd ?? new Date();

  // Idempotency: one invoice per subscription + period end.
  const existing = await prisma.invoice.findFirst({
    where: {
      subscriptionId: subscription.id,
      type: "SUBSCRIPTION",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });
  if (existing) return existing;

  const invoice = await prisma.invoice.create({
    data: {
      orgId: subscription.orgId,
      subscriptionId: subscription.id,
      type: "SUBSCRIPTION",
      amountInr: subscription.totalAmountInr,
      status: InvoiceStatus.PENDING,
      invoiceItems: {
        create: [
          {
            orgId: subscription.orgId,
            type: "PLAN",
            description: `${subscription.plan.name} (${subscription.frequency.toLowerCase()})`,
            quantity: 1,
            unitPriceInr: subscription.baseAmountInr,
            amountInr: subscription.baseAmountInr,
          },
          ...subscription.items.map((item) => ({
            orgId: subscription.orgId,
            type: "ADD_ON" as const,
            description: item.addOn?.name ?? "Add-on",
            quantity: item.quantity,
            unitPriceInr: item.unitPriceInr,
            amountInr: item.totalPriceInr,
          })),
        ],
      },
    },
    include: { invoiceItems: true },
  });

  await logBillingEvent(subscription.orgId, subscription.id, "INVOICE_GENERATED", {
    invoiceId: invoice.id,
    amountInr: invoice.amountInr,
    periodStart,
    periodEnd,
  });

  return invoice;
}

export async function runDailyBilling() {
  const run = await prisma.billingRun.create({ data: { status: "running" } });
  let invoicesCreated = 0;
  let failures = 0;
  const errors: string[] = [];

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const subscriptions = await prisma.customerSubscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      currentPeriodEnd: { lte: tomorrow },
      totalAmountInr: { gt: 0 },
    },
  });

  for (const sub of subscriptions) {
    try {
      const invoice = await createInvoiceForSubscriptionPeriod(sub.id);
      if (invoice) invoicesCreated++;
    } catch (err) {
      failures++;
      errors.push(`sub:${sub.id} ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.billingRun.update({
    where: { id: run.id },
    data: { status: "completed", invoicesCreated, failures, errors },
  });

  return { runId: run.id, invoicesCreated, failures };
}

export async function recordSubscriptionChargeSuccess(subscriptionId: string, paymentEntity: { id: string; amount: number; order_id?: string }) {
  const subscription = await prisma.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { org: true },
  });
  if (!subscription) return;

  const invoice = await createInvoiceForSubscriptionPeriod(subscriptionId);

  await prisma.customerSubscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      paymentFailureCount: 0,
      dunningRetries: 0,
      dunningNextRetryAt: null,
      lastPaymentFailureAt: null,
    },
  });

  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
        paidAt: new Date(),
      },
    });
  }

  await logBillingEvent(subscription.orgId, subscription.id, "SUBSCRIPTION_CHARGE_SUCCESS", {
    paymentId: paymentEntity.id,
    invoiceId: invoice?.id,
  });
}

export async function recordSubscriptionPaymentFailure(subscriptionId: string, failureReason?: string) {
  const subscription = await prisma.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { org: true },
  });
  if (!subscription) return;

  const nextAttempt = subscription.dunningRetries + 1;
  const retryDays = DUNNING_RETRY_DAYS[nextAttempt - 1];
  const shouldCancel = nextAttempt >= MAX_DUNNING_ATTEMPTS;

  await prisma.customerSubscription.update({
    where: { id: subscription.id },
    data: {
      status: shouldCancel ? SubscriptionStatus.CANCELLED : SubscriptionStatus.PAST_DUE,
      paymentFailureCount: { increment: 1 },
      dunningRetries: nextAttempt,
      dunningNextRetryAt: retryDays ? new Date(Date.now() + retryDays * 24 * 60 * 60 * 1000) : null,
      lastPaymentFailureAt: new Date(),
      ...(shouldCancel ? { cancelledAt: new Date(), cancelAtPeriodEnd: false } : {}),
    },
  });

  await prisma.dunningRecord.create({
    data: {
      orgId: subscription.orgId,
      subscriptionId: subscription.id,
      attempt: nextAttempt,
      status: shouldCancel ? "cancelled" : "pending",
      dueAt: retryDays ? new Date(Date.now() + retryDays * 24 * 60 * 60 * 1000) : new Date(),
      failureReason,
    },
  });

  await logBillingEvent(subscription.orgId, subscription.id, shouldCancel ? "SUBSCRIPTION_CANCELLED_DUNNING" : "SUBSCRIPTION_PAYMENT_FAILED", {
    attempt: nextAttempt,
    failureReason,
  });
}

export async function runDunningReminders() {
  const now = new Date();
  const pending = await prisma.dunningRecord.findMany({
    where: { status: "pending", dueAt: { lte: now } },
    include: { subscription: true, org: true },
  });

  for (const record of pending) {
    // Razorpay subscriptions retry automatically; we just update our internal status.
    // If the subscription is already active again, resolve the dunning record.
    if (record.subscription.status === SubscriptionStatus.ACTIVE) {
      await prisma.dunningRecord.update({ where: { id: record.id }, data: { status: "resolved", resolvedAt: new Date() } });
      continue;
    }
    // Otherwise, the next webhook or manual payment will resolve it.
  }

  return { processed: pending.length };
}
