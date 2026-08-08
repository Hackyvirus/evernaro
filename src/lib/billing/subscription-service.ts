"server-only";
import { prisma } from "@/lib/prisma";
import { BillingFrequency, SubscriptionStatus } from "@prisma/client";
import { calculateQuote, resolveAddOnSelections, getPeriodDates } from "./pricing-engine";
import { createInvoiceFromQuote } from "./invoice";
import {
  createRazorpayCustomer,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
} from "./razorpay-billing";
import { createRazorpayOrder } from "@/lib/razorpay";
import { logBillingEvent } from "./events";
import type { AddOnSelection } from "./types";

export type CreateSubscriptionInput = {
  orgId: string;
  ownerEmail: string;
  ownerName: string;
  planId: string;
  frequency?: BillingFrequency;
  addOns?: AddOnSelection[];
  couponCode?: string | null;
};

export async function createSubscription(input: CreateSubscriptionInput) {
  const existing = await prisma.customerSubscription.findFirst({
    where: { orgId: input.orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
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

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { razorpayCustomerId: true },
  });

  let razorpayCustomerId = org?.razorpayCustomerId ?? null;
  let razorpayPlanId: string | null = null;
  let razorpaySubscriptionId: string | null = null;

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

  const subscription = await prisma.customerSubscription.create({
    data: {
      orgId: input.orgId,
      planId: input.planId,
      status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
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
      await prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orgId: input.orgId,
          subscriptionId: subscription.id,
          discountAmountInr: quote.discountAmountInr,
        },
      });
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
    }
  }

  // Create first invoice immediately unless in trial.
  let firstInvoiceRazorpayOrderId: string | undefined;
  if (!trialEnd) {
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

  return { subscription, quote };
}

export async function getActiveSubscription(orgId: string) {
  return prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"] } },
    include: { plan: true, items: { include: { addOn: true } } },
  });
}

export async function changeSubscriptionPlan(input: CreateSubscriptionInput & { prorate?: boolean }) {
  const existing = await prisma.customerSubscription.findFirst({
    where: { orgId: input.orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED"] } },
  });
  if (!existing) {
    throw new Error("No active subscription to change. Please subscribe first.");
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

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { razorpayCustomerId: true },
  });

  let razorpayCustomerId = org?.razorpayCustomerId ?? existing.razorpayCustomerId ?? null;
  let razorpayPlanId: string | null = null;
  let razorpaySubscriptionId: string | null = null;

  // Cancel the old Razorpay subscription immediately so the new plan starts now.
  if (existing.razorpaySubscriptionId) {
    try {
      await cancelRazorpaySubscription(existing.razorpaySubscriptionId, false);
    } catch (err) {
      console.error("Failed to cancel old Razorpay subscription:", err);
    }
  }

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
    console.error("Razorpay subscription change failed:", err);
  }

  // Delete old add-on items and create new ones inside a transaction with the subscription update.
  await prisma.$transaction([
    prisma.subscriptionItem.deleteMany({ where: { subscriptionId: existing.id } }),
    prisma.customerSubscription.update({
      where: { id: existing.id },
      data: {
        planId: input.planId,
        status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
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
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    }),
    ...quote.addOns.map((a) =>
      prisma.subscriptionItem.create({
        data: {
          orgId: input.orgId,
          subscriptionId: existing.id,
          type: "ADD_ON",
          addOnId: a.addOnId,
          quantity: a.quantity,
          unitPriceInr: a.unitPriceInr,
          totalPriceInr: a.amountInr,
        },
      })
    ),
  ]);

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { razorpayCustomerId },
  });

  if (input.couponCode && quote.discountAmountInr > 0) {
    const coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode } });
    if (coupon) {
      // Remove any previous redemption for this org on the same coupon before re-redeeming.
      await prisma.couponRedemption.deleteMany({
        where: { couponId: coupon.id, orgId: input.orgId },
      });
      await prisma.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orgId: input.orgId,
          subscriptionId: existing.id,
          discountAmountInr: quote.discountAmountInr,
        },
      });
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
    }
  }

  let invoice = null;
  let razorpayOrderId: string | undefined;
  if (!trialEnd) {
    try {
      const order = await createRazorpayOrder({
        amountInr: quote.totalInr,
        receipt: `sub-change-${existing.id}`,
      });
      razorpayOrderId = order.id;
    } catch (err) {
      console.error("Failed to create Razorpay order for changed subscription:", err);
    }
    invoice = await createInvoiceFromQuote(input.orgId, existing.id, quote, { status: "PENDING" });
    if (razorpayOrderId && invoice) {
      invoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { razorpayOrderId },
      });
    }
  }

  await logBillingEvent(input.orgId, existing.id, "SUBSCRIPTION_CHANGED", {
    planId: input.planId,
    frequency: quote.frequency,
    totalInr: quote.totalInr,
  });

  const updatedSubscription = await prisma.customerSubscription.findUnique({
    where: { id: existing.id },
    include: { plan: true, items: { include: { addOn: true } } },
  });

  return { subscription: updatedSubscription, quote, invoice, razorpayOrderId };
}

export async function cancelSubscription(orgId: string, cancelAtPeriodEnd = true) {
  const subscription = await prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
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
  return updated;
}
