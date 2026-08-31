"server-only";
import { prisma } from "@/lib/prisma";
import { BillingFrequency, SubscriptionStatus, type Prisma } from "@prisma/client";
import { calculateQuote, resolveAddOnSelections, getPeriodDates } from "./pricing-engine";
import { createInvoiceFromQuote } from "./invoice";
import {
  createRazorpayCustomer,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
} from "./razorpay-billing";
import { createRazorpayOrder } from "@/lib/razorpay";
import { creditWallet } from "@/lib/whatsapp-wallet";
import { logBillingEvent } from "./events";
import { calculateProration } from "./proration";
import {
  SUBSCRIPTION_ACTIVE_STATUSES,
  syncOrganizationStatusFromSubscription,
  mapSubscriptionStatusToOrganizationStatus,
} from "./subscription-status";
import type { AddOnSelection } from "./types";

// Razorpay SDK errors are shaped { statusCode, error: { code, description } }.
// Pull out something human-readable so a failed plan change tells the operator
// *why* (bad key, subscriptions not enabled, account under review, ...) instead
// of a generic "could not initialize payment".
function describeRazorpayError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { error?: { description?: string; code?: string }; statusCode?: number; message?: string };
    const desc = e.error?.description ?? e.message;
    if (desc) return e.statusCode ? `${desc} [${e.statusCode}]` : desc;
    if (e.error?.code) return e.error.code;
  }
  return "unknown error — check server logs";
}

export type CreateSubscriptionInput = {
  orgId: string;
  ownerEmail: string;
  ownerName: string;
  planId: string;
  frequency?: BillingFrequency;
  addOns?: AddOnSelection[];
  couponCode?: string | null;
};

export async function createFreeSubscription(orgId: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: "free" } });
  if (!plan) return null;

  const { start, end } = getPeriodDates(BillingFrequency.MONTHLY);
  try {
    const subscription = await prisma.customerSubscription.create({
      data: {
        orgId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        frequency: BillingFrequency.MONTHLY,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        baseAmountInr: 0,
        discountAmountInr: 0,
        taxAmountInr: 0,
        totalAmountInr: 0,
      },
      include: { plan: true, items: { include: { addOn: true } } },
    });
    await syncOrganizationStatusFromSubscription(orgId);
    return subscription;
  } catch (err) {
    // Partial unique index enforces one active/trialing subscription per org.
    // If a concurrent call created it, return the existing one.
    if (isUniqueConstraintError(err)) {
      return prisma.customerSubscription.findFirst({
        where: { orgId, status: { notIn: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED] } },
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

async function atomicIncrementCouponRedemption(couponId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const result = await client.$executeRawUnsafe(
    `UPDATE "Coupon" SET "redemptionCount" = "redemptionCount" + 1 WHERE id = $1 AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")`,
    couponId
  );
  return Number(result) > 0;
}

async function redeemCouponForSubscription(
  couponCode: string,
  orgId: string,
  subscriptionId: string,
  discountAmountInr: number
): Promise<boolean> {
  const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
  if (!coupon) return false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orgId,
          subscriptionId,
          discountAmountInr,
        },
      });
      const ok = await atomicIncrementCouponRedemption(coupon.id, tx);
      if (!ok) throw new Error("Coupon redemption limit reached");
    });
    return true;
  } catch (err) {
    console.error(`Failed to redeem coupon ${couponCode} for subscription ${subscriptionId}:`, err);
    return false;
  }
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const existing = await prisma.customerSubscription.findFirst({
    where: { orgId: input.orgId, status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES, SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE] } },
  });
  if (existing) {
    throw new Error("Organization already has an active subscription");
  }

  const resolvedAddOns = await resolveAddOnSelections(input.planId, input.addOns ?? []);
  const quote = await calculateQuote({
    planId: input.planId,
    frequency: input.frequency,
    addOns: resolvedAddOns,
    couponCode: input.couponCode,
    orgId: input.orgId,
  });

  const { start, end } = getPeriodDates(quote.frequency);
  const trialEnd = quote.trialEnd;
  const isFreePlan = quote.totalInr === 0;

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { razorpayCustomerId: true },
  });

  let razorpayCustomerId = org?.razorpayCustomerId ?? null;
  let razorpayPlanId: string | null = null;
  let razorpaySubscriptionId: string | null = null;

  if (!isFreePlan) {
    try {
      const customer = await createRazorpayCustomer({
        email: input.ownerEmail,
        name: input.ownerName,
        orgId: input.orgId,
      });
      razorpayCustomerId = customer.id;

      const plan = await createRazorpayPlan({
        period: quote.frequency === BillingFrequency.YEARLY ? "yearly" : "monthly",
        interval: 1,
        amountInr: quote.totalInr,
        name: `${quote.planName} — ${quote.frequency.toLowerCase()}`,
      });
      razorpayPlanId = plan.id;

      const subscription = await createRazorpaySubscription({
        planId: plan.id,
        customerId: customer.id,
        totalCount: 12,
        quantity: 1,
        startAt: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : Math.floor(start.getTime() / 1000),
        expireBy: Math.floor(end.getTime() / 1000),
      });
      razorpaySubscriptionId = subscription.id;
    } catch (err) {
      // Razorpay not configured or call failed — still create local subscription record
      // so the UI can show the selected plan and prompt for payment setup.
      console.error("Razorpay subscription setup failed:", err);
    }
  }

  // Persist coupon details only for multi-period discounts. ONCE coupons are
  // already reflected in the initial quote and should not affect renewals.
  let couponId: string | null = null;
  let couponDiscountMonthsRemaining: number | null = null;
  if (input.couponCode && quote.coupon) {
    if (quote.coupon.duration === "REPEATING") {
      couponId = quote.coupon.id;
      couponDiscountMonthsRemaining = quote.coupon.durationInMonths ?? 1;
    } else if (quote.coupon.duration === "FOREVER") {
      couponId = quote.coupon.id;
      couponDiscountMonthsRemaining = null;
    }
  }

  let subscription: Awaited<ReturnType<typeof prisma.customerSubscription.create>>;
  try {
    subscription = await prisma.customerSubscription.create({
      data: {
        orgId: input.orgId,
        planId: input.planId,
        status: isFreePlan
          ? SubscriptionStatus.ACTIVE
          : trialEnd
            ? SubscriptionStatus.TRIALING
            : SubscriptionStatus.INCOMPLETE,
        frequency: quote.frequency,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        trialEnd,
        razorpayCustomerId,
        razorpayPlanId,
        razorpaySubscriptionId,
        baseAmountInr: quote.baseAmountInr,
        discountAmountInr: quote.discountAmountInr,
        taxAmountInr: quote.taxAmountInr,
        totalAmountInr: quote.totalInr,
        couponId,
        couponDiscountMonthsRemaining,
        items: {
          create: quote.addOns.map((a) => ({
            orgId: input.orgId,
            type: "ADD_ON",
            addOnId: a.addOnId,
            quantity: a.quantity,
            unitPriceInr: a.unitPriceInr,
            totalPriceInr: a.amountInr,
          })),
        },
      },
      include: { plan: true, items: { include: { addOn: true } } },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await prisma.customerSubscription.findFirst({
        where: {
          orgId: input.orgId,
          status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES, SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE] },
        },
        include: { plan: true, items: { include: { addOn: true } } },
      });
      if (existing) return { subscription: existing, quote };
    }
    throw err;
  }

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { razorpayCustomerId },
  });

  if (input.couponCode && quote.discountAmountInr > 0) {
    const redeemed = await redeemCouponForSubscription(
      input.couponCode,
      input.orgId,
      subscription.id,
      quote.discountAmountInr
    );
    if (!redeemed) {
      // Coupon could not be redeemed atomically (likely max redemptions hit).
      // Strip it from the subscription so renewal invoices don't try to reuse it.
      await prisma.customerSubscription.update({
        where: { id: subscription.id },
        data: { couponId: null, couponDiscountMonthsRemaining: null },
      });
    }
  }

  // Create first invoice immediately unless in trial or on a free plan.
  let firstInvoiceRazorpayOrderId: string | undefined;
  if (!trialEnd && !isFreePlan) {
    try {
      const order = await createRazorpayOrder({
        amountInr: quote.totalInr,
        receipt: `sub-${subscription.id}`,
      });
      firstInvoiceRazorpayOrderId = order.id;
    } catch (err) {
      console.error("Failed to create Razorpay order for subscription invoice:", err);
    }
    await createInvoiceFromQuote(input.orgId, subscription.id, quote, { status: "PENDING" });
    if (firstInvoiceRazorpayOrderId) {
      const latestInvoice = await prisma.invoice.findFirst({
        where: { subscriptionId: subscription.id, orgId: input.orgId },
        orderBy: { createdAt: "desc" },
      });
      if (latestInvoice) {
        await prisma.invoice.update({
          where: { id: latestInvoice.id },
          data: { razorpayOrderId: firstInvoiceRazorpayOrderId },
        });
      }
    }
  }

  await logBillingEvent(input.orgId, subscription.id, "SUBSCRIPTION_CREATED", {
    planId: input.planId,
    frequency: quote.frequency,
    totalInr: quote.totalInr,
  });

  await syncOrganizationStatusFromSubscription(input.orgId);
  return { subscription, quote };
}

export async function getActiveSubscription(orgId: string) {
  return prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: SUBSCRIPTION_ACTIVE_STATUSES } },
    include: {
      plan: { include: { features: true, limits: { include: { service: true } } } },
      items: { include: { addOn: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Finalize a plan change by activating the new subscription and cancelling the
 * previous active subscription. Idempotent: safe to call from both the browser
 * confirmation route and the Razorpay webhook.
 */
export async function finalizePlanChange(
  orgId: string,
  newSubscriptionId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const newSub = await client.customerSubscription.findUnique({
    where: { id: newSubscriptionId },
    include: { plan: true },
  });
  if (!newSub || newSub.orgId !== orgId) return;

  // Already finalized.
  if (
    newSub.status !== SubscriptionStatus.INCOMPLETE &&
    newSub.status !== SubscriptionStatus.TRIALING
  ) {
    return;
  }

  const now = new Date();
  const isFreePlan = newSub.totalAmountInr === 0;
  let targetStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE;
  if (!isFreePlan && newSub.trialEnd && newSub.trialEnd > now) {
    targetStatus = SubscriptionStatus.TRIALING;
  }

  const doFinalize = async (txClient: Prisma.TransactionClient) => {
    // Cancel any other active/trialing/past-due subscription for this org.
    const currentActive = await txClient.customerSubscription.findMany({
      where: {
        orgId,
        id: { not: newSub.id },
        status: { in: SUBSCRIPTION_ACTIVE_STATUSES },
      },
    });

    for (const current of currentActive) {
      if (current.razorpaySubscriptionId) {
        try {
          await cancelRazorpaySubscription(current.razorpaySubscriptionId, false);
        } catch (err) {
          console.error("Failed to cancel previous Razorpay subscription during plan change:", err);
        }
      }
      await txClient.customerSubscription.update({
        where: { id: current.id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelAtPeriodEnd: false,
          cancelledAt: new Date(),
        },
      });
    }

    await txClient.customerSubscription.update({
      where: { id: newSub.id },
      data: {
        status: targetStatus,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    await txClient.organization.update({
      where: { id: orgId },
      data: { status: mapSubscriptionStatusToOrganizationStatus(targetStatus) },
    });
  };

  if (tx) {
    await doFinalize(tx);
  } else {
    await prisma.$transaction(doFinalize);
  }

  await logBillingEvent(orgId, newSub.id, "SUBSCRIPTION_CHANGE_FINALIZED", {
    status: targetStatus,
  }, tx);
}

export async function changeSubscriptionPlan(input: CreateSubscriptionInput & { prorate?: boolean; currentSubscriptionId?: string }) {
  // Allow changes from active, trialing, past-due, or incomplete subscriptions
  // so users can recover billing state and so upgrades/downgrades are possible.
  const current = await prisma.customerSubscription.findFirst({
    where: {
      orgId: input.orgId,
      status: {
        in: [
          ...SUBSCRIPTION_ACTIVE_STATUSES,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.INCOMPLETE,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!current) {
    throw new Error("No active subscription to change. Please subscribe first.");
  }
  if (input.currentSubscriptionId && current.id !== input.currentSubscriptionId) {
    throw new Error("The subscription you are trying to change is no longer active.");
  }

  const resolvedAddOns = await resolveAddOnSelections(input.planId, input.addOns ?? []);
  const quote = await calculateQuote({
    planId: input.planId,
    frequency: input.frequency,
    addOns: resolvedAddOns,
    couponCode: input.couponCode,
    orgId: input.orgId,
  });

  const { start, end } = getPeriodDates(quote.frequency);
  const trialEnd = quote.trialEnd;
  const isFreePlan = quote.totalInr === 0;

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { razorpayCustomerId: true },
  });

  let razorpayCustomerId = org?.razorpayCustomerId ?? current.razorpayCustomerId ?? null;
  let razorpayPlanId: string | null = null;
  let razorpaySubscriptionId: string | null = null;

  if (!isFreePlan) {
    try {
      if (!razorpayCustomerId) {
        const customer = await createRazorpayCustomer({
          email: input.ownerEmail,
          name: input.ownerName,
          orgId: input.orgId,
        });
        razorpayCustomerId = customer.id;
      }

      const plan = await createRazorpayPlan({
        period: quote.frequency === BillingFrequency.YEARLY ? "yearly" : "monthly",
        interval: 1,
        amountInr: quote.totalInr,
        name: `${quote.planName} — ${quote.frequency.toLowerCase()}`,
      });
      razorpayPlanId = plan.id;

      const subscription = await createRazorpaySubscription({
        planId: plan.id,
        customerId: razorpayCustomerId,
        totalCount: 12,
        quantity: 1,
        startAt: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : Math.floor(start.getTime() / 1000),
        expireBy: Math.floor(end.getTime() / 1000),
      });
      razorpaySubscriptionId = subscription.id;
    } catch (err) {
      // Do NOT cancel the existing subscription if Razorpay setup fails.
      console.error("Razorpay subscription setup failed for plan change:", err);
      throw new Error(
        `Could not initialize payment for the new plan (${describeRazorpayError(err)}). Your current plan is unchanged.`,
      );
    }
  }

  // Always create the new subscription in a non-active state first. This:
  //   - avoids violating the one-active-per-org partial unique index
  //     (UNIQUE(orgId) WHERE status IN ('TRIALING','ACTIVE')): the current
  //     subscription still occupies that slot until finalizePlanChange runs,
  //   - lets finalizePlanChange safely cancel the previous subscription and
  //     activate the new one in one transactional step.
  // INCOMPLETE even for trials — finalizePlanChange promotes it to TRIALING
  // (see its trialEnd check) after cancelling the previous subscription.
  const initialStatus = SubscriptionStatus.INCOMPLETE;

  const newSubscription = await prisma.customerSubscription.create({
    data: {
      orgId: input.orgId,
      planId: input.planId,
      status: initialStatus,
      frequency: quote.frequency,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      trialEnd,
      razorpayCustomerId,
      razorpayPlanId,
      razorpaySubscriptionId,
      baseAmountInr: quote.baseAmountInr,
      discountAmountInr: quote.discountAmountInr,
      taxAmountInr: quote.taxAmountInr,
      totalAmountInr: quote.totalInr,
      items: {
        create: quote.addOns.map((a) => ({
          orgId: input.orgId,
          type: "ADD_ON",
          addOnId: a.addOnId,
          quantity: a.quantity,
          unitPriceInr: a.unitPriceInr,
          totalPriceInr: a.amountInr,
        })),
      },
    },
    include: { plan: true, items: { include: { addOn: true } } },
  });

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { razorpayCustomerId },
  });

  if (input.couponCode && quote.discountAmountInr > 0) {
    const coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode } });
    if (coupon) {
      try {
        await prisma.$transaction(async (tx) => {
          // Remove any previous redemption for this org on the same coupon and
          // decrement the count so re-redemption doesn't inflate it.
          const deleted = await tx.couponRedemption.deleteMany({
            where: { couponId: coupon.id, orgId: input.orgId },
          });
          if (deleted.count > 0) {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { redemptionCount: { decrement: deleted.count } },
            });
          }
          await tx.couponRedemption.create({
            data: {
              couponId: coupon.id,
              orgId: input.orgId,
              subscriptionId: newSubscription.id,
              discountAmountInr: quote.discountAmountInr,
            },
          });
          const ok = await atomicIncrementCouponRedemption(coupon.id, tx);
          if (!ok) throw new Error("Coupon redemption limit reached");
        });
      } catch (err) {
        console.error(`Failed to redeem coupon ${coupon.code} during plan change:`, err);
        await prisma.customerSubscription.update({
          where: { id: newSubscription.id },
          data: { couponId: null, couponDiscountMonthsRemaining: null },
        });
      }
    }
  }

  let invoice = null;
  let razorpayOrderId: string | undefined;

  if (isFreePlan || trialEnd) {
    // No payment required: swap immediately.
    await finalizePlanChange(input.orgId, newSubscription.id);
  } else {
    let invoiceAmount = quote.totalInr;
    let prorationCredit = 0;

    if (input.prorate) {
      const proration = calculateProration(current, quote.totalInr);
      invoiceAmount = Math.max(0, proration.netInr);
      if (proration.netInr < 0) {
        prorationCredit = Math.abs(proration.netInr);
      }
    }

    if (invoiceAmount === 0) {
      // Downgrade credit scenario: no payment needed, activate new plan now.
      await finalizePlanChange(input.orgId, newSubscription.id);
      if (prorationCredit > 0) {
        await creditWallet(input.orgId, prorationCredit * 100, "MANUAL_CREDIT", {
          note: `Proration credit for plan downgrade (${current.id})`,
        });
      }
    } else {
      try {
        const order = await createRazorpayOrder({
          amountInr: invoiceAmount,
          receipt: `sub-change-${newSubscription.id}`,
        });
        razorpayOrderId = order.id;
      } catch (err) {
        // Roll back the pending subscription so the org is not left in a broken state.
        try {
          await prisma.customerSubscription.delete({ where: { id: newSubscription.id } });
        } catch (rollbackErr) {
          console.error("Failed to roll back pending subscription after Razorpay order failure:", rollbackErr);
        }
        console.error("Failed to create Razorpay order for changed subscription:", err);
        throw new Error("Could not create payment order. Your current plan is unchanged.");
      }

      invoice = await createInvoiceFromQuote(input.orgId, newSubscription.id, quote, {
        status: "PENDING",
        overrideAmount: invoiceAmount,
      });

      if (razorpayOrderId && invoice) {
        invoice = await prisma.invoice.update({
          where: { id: invoice.id },
          data: { razorpayOrderId, amountInr: invoiceAmount },
        });
      }
    }
  }

  await logBillingEvent(input.orgId, newSubscription.id, "SUBSCRIPTION_CHANGE_STARTED", {
    planId: input.planId,
    frequency: quote.frequency,
    totalInr: quote.totalInr,
  });

  return { subscription: newSubscription, quote, invoice, razorpayOrderId };
}

export async function cancelSubscription(orgId: string, cancelAtPeriodEnd = true) {
  const subscription = await prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: SUBSCRIPTION_ACTIVE_STATUSES } },
  });
  if (!subscription) throw new Error("No active subscription");

  if (subscription.razorpaySubscriptionId) {
    try {
      const { cancelRazorpaySubscription } = await import("./razorpay-billing");
      await cancelRazorpaySubscription(subscription.razorpaySubscriptionId, cancelAtPeriodEnd);
    } catch (err) {
      console.error("Failed to cancel Razorpay subscription:", err);
    }
  }

  const updated = await prisma.customerSubscription.update({
    where: { id: subscription.id },
    data: cancelAtPeriodEnd
      ? { cancelAtPeriodEnd: true }
      : { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
  });

  await logBillingEvent(orgId, subscription.id, cancelAtPeriodEnd ? "SUBSCRIPTION_CANCEL_SCHEDULED" : "SUBSCRIPTION_CANCELLED", {});
  await syncOrganizationStatusFromSubscription(orgId);
  return updated;
}

export async function reactivateSubscription(orgId: string) {
  const subscription = await prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: [...SUBSCRIPTION_ACTIVE_STATUSES, SubscriptionStatus.PAUSED] } },
  });
  if (!subscription) throw new Error("No subscription to reactivate");
  if (!subscription.cancelAtPeriodEnd && subscription.status !== SubscriptionStatus.PAUSED) {
    return subscription;
  }

  if (subscription.razorpaySubscriptionId) {
    try {
      const { getRazorpayBillingClient } = await import("./razorpay-billing");
      const client = getRazorpayBillingClient();
      // Attempt to resume a subscription that was cancelled at period end.
      await (client.subscriptions as unknown as { update: (id: string, data: Record<string, unknown>) => Promise<unknown> }).update(
        subscription.razorpaySubscriptionId,
        { cancel_at_cycle_end: 0 }
      );
    } catch (err) {
      console.error("Failed to resume Razorpay subscription:", err);
    }
  }

  const updated = await prisma.customerSubscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false, status: subscription.status === SubscriptionStatus.PAUSED ? SubscriptionStatus.ACTIVE : subscription.status },
  });

  await logBillingEvent(orgId, subscription.id, "SUBSCRIPTION_REACTIVATED", {});
  await syncOrganizationStatusFromSubscription(orgId);
  return updated;
}

export async function recordSubscriptionPayment(
  opts: {
    orgId: string;
    invoiceId?: string;
    subscriptionId?: string;
    amountInr: number;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    status: "PAID" | "FAILED" | "PENDING" | "REFUNDED";
    failureReason?: string;
    metadata?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const data = {
    orgId: opts.orgId,
    invoiceId: opts.invoiceId ?? null,
    subscriptionId: opts.subscriptionId ?? null,
    amountInr: opts.amountInr,
    status: opts.status,
    razorpayPaymentId: opts.razorpayPaymentId ?? null,
    razorpayOrderId: opts.razorpayOrderId ?? null,
    failureReason: opts.failureReason ?? null,
    metadata: (opts.metadata ?? {}) as never,
  };
  if (opts.razorpayPaymentId) {
    return client.payment.upsert({
      where: { razorpayPaymentId: opts.razorpayPaymentId },
      update: data,
      create: data,
    });
  }
  return client.payment.create({ data });
}
