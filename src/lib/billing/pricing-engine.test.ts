import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingFrequency, InvoiceItemType } from "@prisma/client";

const {
  findUniquePlanMock,
  findFirstTaxMock,
  findUniqueCouponMock,
  findUniqueRedemptionMock,
} = vi.hoisted(() => ({
  findUniquePlanMock: vi.fn(),
  findFirstTaxMock: vi.fn(),
  findUniqueCouponMock: vi.fn(),
  findUniqueRedemptionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscriptionPlan: { findUnique: findUniquePlanMock },
    taxConfiguration: { findFirst: findFirstTaxMock },
    coupon: { findUnique: findUniqueCouponMock },
    couponRedemption: { findUnique: findUniqueRedemptionMock },
  },
}));

import { calculateQuote, getPeriodDates, getTaxConfig } from "./pricing-engine";

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan_growth",
    name: "Growth",
    monthlyPriceInr: 1499,
    annualPriceInr: 14990,
    currency: "INR",
    trialDays: 0,
    isActive: true,
    features: [],
    limits: [],
    planAddOns: [],
    ...overrides,
  };
}

function makeAddOn(overrides: Record<string, unknown> = {}) {
  return {
    id: "addon_extra",
    name: "Extra Pack",
    priceInr: 500,
    frequency: BillingFrequency.MONTHLY,
    minQuantity: 1,
    maxQuantity: 5,
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  findUniquePlanMock.mockReset();
  findFirstTaxMock.mockReset();
  findUniqueCouponMock.mockReset();
  findUniqueRedemptionMock.mockReset();
  findFirstTaxMock.mockResolvedValue({ name: "GST", rate: 18, inclusive: false });
});

describe("getPeriodDates", () => {
  it("returns monthly period", () => {
    const { start, end } = getPeriodDates(BillingFrequency.MONTHLY, new Date("2026-08-07T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T23:59:59.000Z");
  });

  it("returns yearly period", () => {
    const { start, end } = getPeriodDates(BillingFrequency.YEARLY, new Date("2026-08-07T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-07-31T23:59:59.000Z");
  });
});

describe("getTaxConfig", () => {
  it("returns configured tax", async () => {
    findFirstTaxMock.mockResolvedValue({ name: "GST", rate: 18, inclusive: false });
    const config = await getTaxConfig();
    expect(config.rate).toBe(18);
  });

  it("falls back to default GST", async () => {
    findFirstTaxMock.mockResolvedValue(null);
    const config = await getTaxConfig();
    expect(config).toMatchObject({ name: "GST", rate: 18, inclusive: false });
  });
});

describe("calculateQuote", () => {
  it("calculates a monthly plan quote with tax", async () => {
    findUniquePlanMock.mockResolvedValue(makePlan());
    const quote = await calculateQuote({ planId: "plan_growth" });
    expect(quote.baseAmountInr).toBe(1499);
    expect(quote.subtotalInr).toBe(1499);
    expect(quote.taxAmountInr).toBe(270); // 18% of 1499 rounded
    expect(quote.totalInr).toBe(1769);
    expect(quote.frequency).toBe(BillingFrequency.MONTHLY);
    expect(quote.lineItems[0].type).toBe(InvoiceItemType.PLAN);
  });

  it("calculates yearly plan quote", async () => {
    findUniquePlanMock.mockResolvedValue(makePlan());
    const quote = await calculateQuote({ planId: "plan_growth", frequency: BillingFrequency.YEARLY });
    expect(quote.baseAmountInr).toBe(14990);
    expect(quote.totalInr).toBe(17688); // 14990 + 18%
  });

  it("includes eligible add-ons", async () => {
    const addOn = makeAddOn();
    findUniquePlanMock.mockResolvedValue(
      makePlan({ planAddOns: [{ isActive: true, addOnId: "addon_extra", addOn }] })
    );
    const quote = await calculateQuote({
      planId: "plan_growth",
      addOns: [{ addOnId: "addon_extra", quantity: 2 }],
    });
    expect(quote.addOns).toHaveLength(1);
    expect(quote.addOns[0].amountInr).toBe(1000);
    expect(quote.subtotalInr).toBe(2499);
  });

  it("rejects ineligible add-ons", async () => {
    findUniquePlanMock.mockResolvedValue(makePlan());
    await expect(
      calculateQuote({ planId: "plan_growth", addOns: [{ addOnId: "addon_extra", quantity: 1 }] })
    ).rejects.toThrow("Add-on is not eligible for this plan");
  });

  it("applies percentage coupon", async () => {
    findUniquePlanMock.mockResolvedValue(makePlan());
    findUniqueCouponMock.mockResolvedValue({
      id: "coupon_1",
      code: "SAVE20",
      type: "PERCENTAGE",
      value: 20,
      applicablePlanIds: [],
      maxRedemptions: 100,
      redemptionCount: 0,
      validFrom: new Date("2020-01-01"),
      validUntil: null,
      minAmountInr: null,
      isActive: true,
    });
    findUniqueRedemptionMock.mockResolvedValue(null);

    const quote = await calculateQuote({ planId: "plan_growth", couponCode: "SAVE20", orgId: "org_1" });
    expect(quote.discountAmountInr).toBe(300); // 20% of 1499
    expect(quote.subtotalInr).toBe(1199);
    expect(quote.totalInr).toBe(1415); // 1199 + 18%
  });

  it("applies inclusive tax correctly", async () => {
    findFirstTaxMock.mockResolvedValue({ name: "GST", rate: 18, inclusive: true });
    findUniquePlanMock.mockResolvedValue(makePlan());
    const quote = await calculateQuote({ planId: "plan_growth" });
    expect(quote.taxInclusive).toBe(true);
    expect(quote.totalInr).toBe(1499);
    expect(quote.taxAmountInr).toBe(229); // tax included in total
  });

  it("throws for missing plan", async () => {
    findUniquePlanMock.mockResolvedValue(null);
    await expect(calculateQuote({ planId: "missing" })).rejects.toThrow("Plan not found");
  });

  it("respects plan trial days", async () => {
    findUniquePlanMock.mockResolvedValue(makePlan({ trialDays: 14 }));
    const quote = await calculateQuote({ planId: "plan_growth" });
    expect(quote.trialEnd).toBeInstanceOf(Date);
  });
});
