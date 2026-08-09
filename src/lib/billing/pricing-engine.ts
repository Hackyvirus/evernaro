import { prisma } from "@/lib/prisma";
import { BillingFrequency, InvoiceItemType, type Coupon } from "@prisma/client";
import type { CalculateQuoteInput, Quote, QuoteAddOn, QuoteItem, AddOnSelection } from "./types";

const MONTHS_PER_YEAR = 12;

export function getPeriodDates(frequency: BillingFrequency, now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(1);

  const end = new Date(start);
  if (frequency === BillingFrequency.YEARLY) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  end.setUTCSeconds(end.getUTCSeconds() - 1);

  return { start, end };
}

export async function getTaxConfig() {
  const config = await prisma.taxConfiguration.findFirst({ where: { enabled: true } });
  if (config) return config;
  return { rate: 18, inclusive: false, name: "GST" };
}

export async function calculateQuote(input: CalculateQuoteInput): Promise<Quote> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: input.planId, isActive: true },
    include: {
      features: true,
      limits: { include: { service: true } },
      planAddOns: { include: { addOn: true } },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  const frequency = input.frequency ?? BillingFrequency.MONTHLY;
  const baseAmountInr = frequency === BillingFrequency.YEARLY ? plan.annualPriceInr : plan.monthlyPriceInr;

  const lineItems: QuoteItem[] = [
    {
      type: InvoiceItemType.PLAN,
      description: `${plan.name} — ${frequency.toLowerCase()}`,
      quantity: 1,
      unitPriceInr: baseAmountInr,
      amountInr: baseAmountInr,
    },
  ];

  let addOnsTotal = 0;
  const selectedAddOns: QuoteAddOn[] = [];

  if (input.addOns && input.addOns.length > 0) {
    const eligibleAddOnIds = new Set(plan.planAddOns.filter((pa) => pa.isActive).map((pa) => pa.addOnId));

    for (const selection of input.addOns) {
      if (!eligibleAddOnIds.has(selection.addOnId)) {
        throw new Error("Add-on is not eligible for this plan");
      }
      const addOn = plan.planAddOns.find((pa) => pa.addOnId === selection.addOnId)?.addOn;
      if (!addOn || !addOn.isActive) {
        throw new Error("Add-on not found");
      }
      if (selection.quantity < addOn.minQuantity) {
        throw new Error(`Minimum quantity for ${addOn.name} is ${addOn.minQuantity}`);
      }
      if (addOn.maxQuantity !== null && selection.quantity > addOn.maxQuantity) {
        throw new Error(`Maximum quantity for ${addOn.name} is ${addOn.maxQuantity}`);
      }

      let unitPrice = addOn.priceInr;
      if (frequency === BillingFrequency.YEARLY && addOn.frequency === BillingFrequency.MONTHLY) {
        unitPrice = unitPrice * MONTHS_PER_YEAR;
      }
      const amount = unitPrice * selection.quantity;
      addOnsTotal += amount;
      selectedAddOns.push({
        addOnId: addOn.id,
        name: addOn.name,
        quantity: selection.quantity,
        unitPriceInr: unitPrice,
        amountInr: amount,
      });
      lineItems.push({
        type: InvoiceItemType.ADD_ON,
        description: addOn.name,
        quantity: selection.quantity,
        unitPriceInr: unitPrice,
        amountInr: amount,
      });
    }
  }

  let discountAmount = 0;
  let appliedCoupon: Coupon | null = null;
  if (input.couponCode && input.orgId) {
    const coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode, isActive: true } });
    if (coupon) {
      const now = new Date();
      const inValidityWindow = coupon.validFrom <= now && (!coupon.validUntil || coupon.validUntil >= now);
      const underMax = !coupon.maxRedemptions || coupon.redemptionCount < coupon.maxRedemptions;
      const planAllowed = coupon.applicablePlanIds.length === 0 || coupon.applicablePlanIds.includes(plan.id);
      const alreadyRedeemed = await prisma.couponRedemption.findUnique({
        where: { couponId_orgId: { couponId: coupon.id, orgId: input.orgId } },
      });

      if (inValidityWindow && underMax && planAllowed && !alreadyRedeemed) {
        const subtotalBeforeDiscount = baseAmountInr + addOnsTotal;
        if (!coupon.minAmountInr || subtotalBeforeDiscount >= coupon.minAmountInr) {
          if (coupon.type === "PERCENTAGE") {
            discountAmount = Math.round((subtotalBeforeDiscount * coupon.value) / 100);
          } else {
            discountAmount = Math.min(coupon.value, subtotalBeforeDiscount);
          }
          if (discountAmount > 0) {
            appliedCoupon = coupon;
            lineItems.push({
              type: InvoiceItemType.DISCOUNT,
              description: `Coupon ${coupon.code}`,
              quantity: 1,
              unitPriceInr: -discountAmount,
              amountInr: -discountAmount,
            });
          }
        }
      }
    }
  }

  const subtotal = baseAmountInr + addOnsTotal - discountAmount;
  const taxConfig = await getTaxConfig();
  let taxAmount = 0;
  let total = subtotal;

  if (taxConfig.inclusive) {
    taxAmount = Math.round(subtotal - subtotal / (1 + taxConfig.rate / 100));
    // total stays subtotal (tax included)
  } else {
    taxAmount = Math.round((subtotal * taxConfig.rate) / 100);
    total = subtotal + taxAmount;
  }

  if (!taxConfig.inclusive && taxAmount > 0) {
    lineItems.push({
      type: InvoiceItemType.TAX,
      description: `${taxConfig.name} (${taxConfig.rate}%)`,
      quantity: 1,
      unitPriceInr: taxAmount,
      amountInr: taxAmount,
    });
  }

  const { start, end } = getPeriodDates(frequency);

  return {
    planId: plan.id,
    planName: plan.name,
    frequency,
    baseAmountInr: baseAmountInr,
    addOns: selectedAddOns,
    discountAmountInr: discountAmount,
    subtotalInr: subtotal,
    taxRate: taxConfig.rate,
    taxAmountInr: taxAmount,
    taxInclusive: taxConfig.inclusive,
    totalInr: total,
    currency: plan.currency,
    lineItems,
    periodStart: start,
    periodEnd: end,
    trialEnd: plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000) : null,
    coupon: appliedCoupon,
  };
}

export async function resolveAddOnSelections(
  planId: string,
  selections: AddOnSelection[]
): Promise<AddOnSelection[]> {
  if (!selections.length) return [];
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include: { planAddOns: { where: { isActive: true }, include: { addOn: true } } },
  });
  if (!plan) throw new Error("Plan not found");

  const eligible = new Map(plan.planAddOns.map((pa) => [pa.addOnId, pa.addOn]));
  const resolved: AddOnSelection[] = [];
  for (const s of selections) {
    const addOn = eligible.get(s.addOnId);
    if (!addOn || !addOn.isActive) {
      throw new Error("Add-on is not eligible for this plan");
    }
    const quantity = Math.max(addOn.minQuantity, Math.min(s.quantity, addOn.maxQuantity ?? Infinity));
    if (quantity > 0) resolved.push({ addOnId: s.addOnId, quantity });
  }
  return resolved;
}
