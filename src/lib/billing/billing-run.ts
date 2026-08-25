"server-only";
import { prisma } from "@/lib/prisma";
import { BillingFrequency, InvoiceStatus, SubscriptionStatus, type Prisma } from "@prisma/client";
import { logBillingEvent } from "./events";
import { syncOrganizationStatusFromSubscription } from "./subscription-status";
import { checkUsageLimit } from "./entitlements";
import { getTaxConfig } from "./pricing-engine";
import { recordSubscriptionPayment, finalizePlanChange } from "./subscription-service";
import { createRazorpayOrder } from "@/lib/razorpay";
import { sendPaymentFailedEmail } from "@/lib/billing-email";
import { bigintAdvisoryKey } from "@/lib/keys";

const DUNNING_RETRY_DAYS = [1, 3, 7];
const MAX_DUNNING_ATTEMPTS = DUNNING_RETRY_DAYS.length;

export function addPeriod(date: Date, frequency: BillingFrequency): Date {
  const result = new Date(date);
  if (frequency === BillingFrequency.YEARLY) {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
  } else {
    result.setUTCMonth(result.getUTCMonth() + 1);
  }
  return result;
}

function endOfPeriod(start: Date, frequency: BillingFrequency): Date {
  const end = addPeriod(start, frequency);
  end.setUTCSeconds(end.getUTCSeconds() - 1);
  return end;
}

export async function advanceSubscriptionPeriod(
  subscriptionId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const subscription = await client.customerSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription || !subscription.currentPeriodEnd) return;

  const nextStart = new Date(subscription.currentPeriodEnd.getTime() + 1000);
  const nextEnd = endOfPeriod(nextStart, subscription.frequency);

  await client.customerSubscription.update({
    where: { id: subscriptionId },
    data: { currentPeriodStart: nextStart, currentPeriodEnd: nextEnd },
  });
}

export async function expireTrials(tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const now = new Date();
  const expiring = await client.customerSubscription.findMany({
    where: { status: SubscriptionStatus.TRIALING, trialEnd: { lte: now } },
    include: { plan: true, org: true },
  });

  let expired = 0;
  for (const sub of expiring) {
    try {
      // Restart the billing period at trial expiry so the first invoice is
      // for the next full period, not the partially-consumed trial period.
      const periodStart = now;
      const periodEnd = endOfPeriod(periodStart, sub.frequency);
      await client.customerSubscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ACTIVE, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      });
      const invoice = await createInvoiceForSubscriptionPeriod(sub.id, client);
      if (invoice && !invoice.razorpayOrderId) {
        try {
          const order = await createRazorpayOrder({
            amountInr: invoice.amountInr,
            receipt: `trial-expiry-${invoice.id}`,
          });
          await client.invoice.update({
            where: { id: invoice.id },
            data: { razorpayOrderId: order.id },
          });
        } catch (orderErr) {
          // Razorpay not configured: invoice stays payable manually via platform.
          console.error(`Failed to create Razorpay order for trial-expiry invoice ${invoice.id}:`, orderErr);
        }
      }
      await syncOrganizationStatusFromSubscription(sub.orgId, client);
      expired++;
    } catch (err) {
      console.error(`Failed to expire trial for subscription ${sub.id}:`, err);
    }
  }
  return { expired };
}

function parseOverageUnit(unit: string | null | undefined): number {
  if (!unit) return 1;
  const parsed = Number(unit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function calculateOverageLineItems(orgId: string, subscriptionId: string) {
  const planLimits = await prisma.planLimit.findMany({
    where: { plan: { subscriptions: { some: { id: subscriptionId } } } },
    include: { service: true },
  });

  const overages: Array<{
    description: string;
    quantity: number;
    unitPriceInr: number;
    amountInr: number;
  }> = [];

  for (const limit of planLimits) {
    if (limit.overagePriceInr == null) continue;
    const check = await checkUsageLimit(orgId, limit.service.key, 1);
    if (check.used <= check.included) continue;
    const overageQty = check.used - check.included;
    const unit = parseOverageUnit(limit.service.unit ?? limit.overageUnit);
    const chargeableUnits = Math.ceil(overageQty / unit);
    const amountInr = chargeableUnits * limit.overagePriceInr;
    overages.push({
      description: `${limit.service.name} overage`,
      quantity: overageQty,
      unitPriceInr: limit.overagePriceInr,
      amountInr,
    });
  }

  return overages;
}

export async function createInvoiceForSubscriptionPeriod(
  subscriptionId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const subscription = await client.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, items: { include: { addOn: true } }, org: true, coupon: true },
  });
  if (!subscription) throw new Error("Subscription not found");

  const periodStart = subscription.currentPeriodStart ?? new Date();
  const periodEnd = subscription.currentPeriodEnd ?? new Date();

  // Idempotency: one invoice per subscription + period end. The unique
  // constraint raises P2002 on races; we return the winner.
  const existing = await client.invoice.findUnique({
    where: {
      subscriptionId_type_periodEnd: {
        subscriptionId: subscription.id,
        type: "SUBSCRIPTION",
        periodEnd,
      },
    },
  });
  if (existing) return existing;

  const overageItems = await calculateOverageLineItems(subscription.orgId, subscription.id);
  const overageTotal = overageItems.reduce((sum, item) => sum + item.amountInr, 0);

  // Renewal quote starts from the stored base plan price + add-ons, then
  // re-applies any active multi-period coupon and overages, and finally
  // recalculates tax so coupon/overage changes are reflected correctly.
  const addOnsTotal = subscription.items.reduce((sum, item) => sum + item.totalPriceInr, 0);
  const planAndAddOnsSubtotal = subscription.baseAmountInr + addOnsTotal;
  const coupon = subscription.coupon;
  const couponActive =
    coupon &&
    (coupon.duration === "FOREVER" ||
      (subscription.couponDiscountMonthsRemaining != null && subscription.couponDiscountMonthsRemaining > 0));

  let discountAmountInr = 0;
  if (couponActive) {
    if (coupon.type === "PERCENTAGE") {
      discountAmountInr = Math.round((planAndAddOnsSubtotal * coupon.value) / 100);
    } else {
      discountAmountInr = Math.min(coupon.value, planAndAddOnsSubtotal);
    }
  }

  const taxableSubtotal = Math.max(0, planAndAddOnsSubtotal - discountAmountInr) + overageTotal;
  const taxConfig = await getTaxConfig();
  let taxAmountInr = 0;
  let invoiceAmount = taxableSubtotal;
  if (taxConfig.inclusive) {
    taxAmountInr = Math.round(taxableSubtotal - taxableSubtotal / (1 + taxConfig.rate / 100));
  } else {
    taxAmountInr = Math.round((taxableSubtotal * taxConfig.rate) / 100);
    invoiceAmount = taxableSubtotal + taxAmountInr;
  }

  // Nothing to invoice this period (e.g. free plan with no overages).
  if (invoiceAmount === 0 && overageItems.length === 0 && planAndAddOnsSubtotal === 0) {
    return null;
  }

  const lineItems: Prisma.InvoiceItemCreateManyInvoiceInputEnvelope["data"] = [];
  if (subscription.baseAmountInr > 0) {
    lineItems.push({
      orgId: subscription.orgId,
      type: "PLAN",
      description: `${subscription.plan.name} (${subscription.frequency.toLowerCase()})`,
      quantity: 1,
      unitPriceInr: subscription.baseAmountInr,
      amountInr: subscription.baseAmountInr,
    });
  }
  for (const item of subscription.items) {
    lineItems.push({
      orgId: subscription.orgId,
      type: "ADD_ON",
      description: item.addOn?.name ?? "Add-on",
      quantity: item.quantity,
      unitPriceInr: item.unitPriceInr,
      amountInr: item.totalPriceInr,
    });
  }
  if (discountAmountInr > 0 && coupon) {
    lineItems.push({
      orgId: subscription.orgId,
      type: "DISCOUNT",
      description: `Coupon ${coupon.code}`,
      quantity: 1,
      unitPriceInr: -discountAmountInr,
      amountInr: -discountAmountInr,
    });
  }
  for (const item of overageItems) {
    lineItems.push({
      orgId: subscription.orgId,
      type: "OVERAGE",
      description: item.description,
      quantity: item.quantity,
      unitPriceInr: item.unitPriceInr,
      amountInr: item.amountInr,
    });
  }
  if (!taxConfig.inclusive && taxAmountInr > 0) {
    lineItems.push({
      orgId: subscription.orgId,
      type: "TAX",
      description: `${taxConfig.name} (${taxConfig.rate}%)`,
      quantity: 1,
      unitPriceInr: taxAmountInr,
      amountInr: taxAmountInr,
    });
  }

  try {
    const invoice = await client.invoice.create({
      data: {
        orgId: subscription.orgId,
        subscriptionId: subscription.id,
        type: "SUBSCRIPTION",
        amountInr: invoiceAmount,
        status: InvoiceStatus.PENDING,
        periodStart,
        periodEnd,
        invoiceItems: { create: lineItems },
      },
      include: { invoiceItems: true },
    });

    // Decrement remaining coupon months after successfully creating the invoice.
    if (coupon && subscription.couponDiscountMonthsRemaining != null && subscription.couponDiscountMonthsRemaining > 0) {
      await client.customerSubscription.update({
        where: { id: subscription.id },
        data: { couponDiscountMonthsRemaining: { decrement: 1 } },
      });
    }

    await logBillingEvent(subscription.orgId, subscription.id, "INVOICE_GENERATED", {
      invoiceId: invoice.id,
      amountInr: invoice.amountInr,
      periodStart,
      periodEnd,
    });

    return invoice;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return client.invoice.findUniqueOrThrow({
        where: {
          subscriptionId_type_periodEnd: {
            subscriptionId: subscription.id,
            type: "SUBSCRIPTION",
            periodEnd,
          },
        },
      });
    }
    throw err;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

export async function runDailyBilling() {
  const today = new Date().toISOString().slice(0, 10);
  const lockKey = bigintAdvisoryKey(`billing:daily:${today}`);

  return prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns void — $queryRawUnsafe expects a result
    // set to deserialize and throws on every call; $executeRawUnsafe is for
    // statements with no rows to return. The ::bigint cast is required too —
    // Prisma's raw-parameter serializer can't convert a native JS bigint on
    // its own ("Could not convert from `JSON bigint value` to `PrismaValue`").
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::bigint)", lockKey);

    const run = await tx.billingRun.create({ data: { status: "running" } });
    let invoicesCreated = 0;
    let failures = 0;
    const errors: string[] = [];

    await expireTrials(tx);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const subscriptions = await tx.customerSubscription.findMany({
      where: {
        // Trials are invoiced only through expireTrials() once trialEnd passes.
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lte: tomorrow },
      },
    });

    for (const sub of subscriptions) {
      try {
        const invoice = await createInvoiceForSubscriptionPeriod(sub.id, tx);
        if (invoice) invoicesCreated++;
      } catch (err) {
        failures++;
        errors.push(`sub:${sub.id} ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await tx.billingRun.update({
      where: { id: run.id },
      data: { status: "completed", invoicesCreated, failures, errors },
    });

    return { runId: run.id, invoicesCreated, failures };
  });
}

export async function applySubscriptionPayment(
  subscriptionId: string,
  paymentEntity: { id: string; amount: number; order_id?: string },
  opts: { eventType: string; eventId?: string; tx?: Prisma.TransactionClient; advancePeriod?: boolean }
) {
  const client = opts.tx ?? prisma;
  const lockKey = bigintAdvisoryKey(`subscription:payment:${subscriptionId}`);

  // Serialize concurrent payment applications for the same subscription across
  // Razorpay webhook and browser confirmation paths to prevent double period advance.
  // pg_advisory_xact_lock returns void — $queryRawUnsafe expects a result set
  // to deserialize and throws on every call; $executeRawUnsafe is for
  // statements with no rows to return. The ::bigint cast is required too —
  // Prisma's raw-parameter serializer can't convert a native JS bigint on
  // its own ("Could not convert from `JSON bigint value` to `PrismaValue`").
  await client.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::bigint)", lockKey);

  const subscription = await client.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { org: true },
  });
  if (!subscription) return { invoice: null, alreadyPaid: false };

  // Idempotency per Razorpay payment id. If we've already processed this
  // payment successfully, do not advance the period a second time.
  const existingPayment = await client.payment.findUnique({
    where: { razorpayPaymentId: paymentEntity.id },
  });
  if (existingPayment?.status === "PAID" && existingPayment.invoiceId) {
    const existingInvoice = await client.invoice.findUnique({
      where: { id: existingPayment.invoiceId },
    });
    if (existingInvoice?.status === InvoiceStatus.PAID) {
      return { invoice: existingInvoice, alreadyPaid: true };
    }
  }

  const invoice = await createInvoiceForSubscriptionPeriod(subscriptionId, client);
  if (!invoice) return { invoice: null, alreadyPaid: false };

  const expectedPaise = invoice.amountInr * 100;
  if (paymentEntity.amount !== expectedPaise) {
    await logBillingEvent(
      subscription.orgId,
      subscription.id,
      "SUBSCRIPTION_CHARGE_AMOUNT_MISMATCH",
      {
        paymentId: paymentEntity.id,
        invoiceId: invoice.id,
        expectedPaise,
        receivedPaise: paymentEntity.amount,
      },
      client
    );
    return { invoice, alreadyPaid: false };
  }

  const wasAlreadyPaid = invoice.status === InvoiceStatus.PAID;

  if (!wasAlreadyPaid) {
    await client.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id ?? null,
        paidAt: new Date(),
      },
    });
  }

  const isFirstPayment =
    subscription.status === SubscriptionStatus.INCOMPLETE || subscription.status === SubscriptionStatus.TRIALING;

  if (isFirstPayment) {
    await finalizePlanChange(subscription.orgId, subscription.id, client);
  } else if (!wasAlreadyPaid) {
    await client.customerSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        paymentFailureCount: 0,
        dunningRetries: 0,
        dunningNextRetryAt: null,
        lastPaymentFailureAt: null,
      },
    });
    if (opts.advancePeriod !== false) {
      await advanceSubscriptionPeriod(subscription.id, client);
    }
    await syncOrganizationStatusFromSubscription(subscription.orgId, client);
  }

  await recordSubscriptionPayment(
    {
      orgId: subscription.orgId,
      invoiceId: invoice.id,
      subscriptionId: subscription.id,
      amountInr: invoice.amountInr,
      razorpayPaymentId: paymentEntity.id,
      razorpayOrderId: paymentEntity.order_id,
      status: "PAID",
      metadata: { source: "webhook", event: opts.eventType },
    },
    client
  );

  return { invoice, alreadyPaid: wasAlreadyPaid };
}

export async function recordSubscriptionPaymentFailure(
  subscriptionId: string,
  failureReason?: string,
  tx?: Prisma.TransactionClient,
  eventId?: string
) {
  const client = tx ?? prisma;
  const subscription = await client.customerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { org: true },
  });
  if (!subscription) return;

  // Idempotency: a redelivered webhook event must not create duplicate dunning.
  if (eventId) {
    const existing = await client.dunningRecord.findUnique({ where: { eventId } });
    if (existing) return;
  }

  const nextAttempt = subscription.dunningRetries + 1;
  const retryDays = DUNNING_RETRY_DAYS[nextAttempt - 1];
  const shouldCancel = nextAttempt >= MAX_DUNNING_ATTEMPTS;

  await client.customerSubscription.update({
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

  await client.dunningRecord.create({
    data: {
      orgId: subscription.orgId,
      subscriptionId: subscription.id,
      eventId,
      attempt: nextAttempt,
      status: shouldCancel ? "cancelled" : "pending",
      dueAt: retryDays ? new Date(Date.now() + retryDays * 24 * 60 * 60 * 1000) : new Date(),
      failureReason,
    },
  });

  await syncOrganizationStatusFromSubscription(subscription.orgId, tx);

  await logBillingEvent(subscription.orgId, subscription.id, shouldCancel ? "SUBSCRIPTION_CANCELLED_DUNNING" : "SUBSCRIPTION_PAYMENT_FAILED", {
    attempt: nextAttempt,
    failureReason,
  }, tx);
}

export async function runDunningReminders() {
  const now = new Date();
  const pending = await prisma.dunningRecord.findMany({
    where: { status: "pending", dueAt: { lte: now } },
    include: { subscription: true, org: true },
  });

  let processed = 0;
  for (const record of pending) {
    try {
      // If the subscription recovered (e.g. webhook or manual payment), resolve.
      if (record.subscription.status === SubscriptionStatus.ACTIVE) {
        await prisma.dunningRecord.update({
          where: { id: record.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        processed++;
        continue;
      }

      // Send a reminder email to the org owner and mark this attempt reminded.
      const owner = await prisma.user.findFirst({
        where: { orgId: record.orgId, role: "OWNER" },
        select: { email: true },
      });
      const invoice = await prisma.invoice.findFirst({
        where: { subscriptionId: record.subscriptionId, orgId: record.orgId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
      if (owner && invoice) {
        try {
          await sendPaymentFailedEmail(owner.email, record.org.name, invoice.id, invoice.amountInr);
        } catch (emailErr) {
          console.error(`Failed to send dunning reminder email for record ${record.id}:`, emailErr);
        }
      }

      await prisma.dunningRecord.update({
        where: { id: record.id },
        data: { status: "reminded" },
      });
      await logBillingEvent(record.orgId, record.subscriptionId, "DUNNING_REMINDER_SENT", {
        dunningRecordId: record.id,
        attempt: record.attempt,
      });
      processed++;
    } catch (err) {
      console.error(`Failed to process dunning record ${record.id}:`, err);
    }
  }

  return { processed };
}
