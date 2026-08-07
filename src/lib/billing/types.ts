import type { BillingFrequency, BillingType, InvoiceItemType } from "@prisma/client";

export type QuoteItem = {
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unitPriceInr: number;
  amountInr: number;
};

export type QuoteAddOn = {
  addOnId: string;
  name: string;
  quantity: number;
  unitPriceInr: number;
  amountInr: number;
};

export type Quote = {
  planId: string;
  planName: string;
  frequency: BillingFrequency;
  baseAmountInr: number;
  addOns: QuoteAddOn[];
  discountAmountInr: number;
  subtotalInr: number;
  taxRate: number;
  taxAmountInr: number;
  taxInclusive: boolean;
  totalInr: number;
  currency: string;
  lineItems: QuoteItem[];
  periodStart: Date;
  periodEnd: Date;
  trialEnd?: Date | null;
};

export type AddOnSelection = {
  addOnId: string;
  quantity: number;
};

export type CalculateQuoteInput = {
  planId: string;
  frequency?: BillingFrequency;
  addOns?: AddOnSelection[];
  couponCode?: string | null;
  orgId?: string; // for coupon redemption checks
};

export type UsageSummary = {
  serviceId: string;
  serviceKey: string;
  serviceName: string;
  unit: string;
  included: number;
  used: number;
  remaining: number;
  overage: number;
  overageCostInr: number;
  percentUsed: number;
};

export type PlanLimitInput = {
  serviceKey: string;
  includedQuantity: number;
  overagePriceInr?: number | null;
  overageUnit?: string | null;
};

export type PlanFeatureInput = {
  key: string;
  label: string;
  value?: string | null;
  included?: boolean;
};

export type ServicePricingRuleInput = {
  billingType: BillingType;
  priceInr: number;
  tierMin?: number | null;
  tierMax?: number | null;
  overagePriceInr?: number | null;
};

export { BillingFrequency, BillingType };
