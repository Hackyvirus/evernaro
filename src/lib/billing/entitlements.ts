"server-only";

import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PAUSED,
];

export async function getOrgSubscription(orgId: string) {
  return prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: ACTIVE_STATUSES } },
    include: {
      plan: {
        include: {
          features: true,
          limits: { include: { service: true } },
        },
      },
      items: { include: { addOn: { include: { service: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasFeature(orgId: string, featureKey: string): Promise<boolean> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return false;
  const feature = subscription.plan.features.find((f: { key: string; included: boolean }) => f.key === featureKey);
  return feature?.included ?? false;
}

function addOnQuantityForService(
  subscription: Awaited<ReturnType<typeof getOrgSubscription>>,
  serviceKey: string
): number {
  if (!subscription?.items) return 0;
  return subscription.items
    .filter((item) => item.type === "ADD_ON" && item.addOn?.service?.key === serviceKey)
    .reduce((sum, item) => sum + (item.addOn?.includedQuantity ?? 0) * Math.max(1, item.quantity), 0);
}

export async function getPlanLimit(orgId: string, serviceKey: string): Promise<number> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return 0;
  const limit = subscription.plan.limits.find((l: { service: { key: string }; includedQuantity: number }) => l.service.key === serviceKey);
  const baseLimit = limit?.includedQuantity ?? 0;
  return baseLimit + addOnQuantityForService(subscription, serviceKey);
}

export type UsageCheck = {
  allowed: boolean;
  used: number;
  included: number;
  remaining: number;
  overageAllowed: boolean;
};

export async function checkUsageLimit(
  orgId: string,
  serviceKey: string,
  additionalQty = 1
): Promise<UsageCheck> {
  const subscription = await getOrgSubscription(orgId);
  const limit = subscription?.plan.limits.find((l: { service: { key: string }; includedQuantity: number; overagePriceInr: number | null }) => l.service.key === serviceKey);
  const baseIncluded = limit?.includedQuantity ?? 0;
  const included = baseIncluded + addOnQuantityForService(subscription, serviceKey);
  const overageAllowed = limit?.overagePriceInr != null;
  const periodStart = subscription?.currentPeriodStart ?? new Date(0);
  const periodEnd = subscription?.currentPeriodEnd ?? new Date(8640000000000000);
  const used = await getActualUsage(orgId, serviceKey, periodStart, periodEnd);
  const remaining = Math.max(0, included - used);
  const allowed = remaining >= additionalQty || overageAllowed;
  return { allowed, used, included, remaining, overageAllowed };
}

async function getActualUsage(
  orgId: string,
  serviceKey: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  switch (serviceKey) {
    case "contacts":
      return prisma.contact.count({ where: { orgId } });
    case "users":
      return prisma.user.count({ where: { orgId, isActive: true } });
    case "campaigns": {
      const agg = await prisma.campaign.aggregate({
        where: { orgId, createdAt: { gte: periodStart, lte: periodEnd } },
        _sum: { totalRecipients: true },
      });
      return agg._sum.totalRecipients ?? 0;
    }
    case "conversations": {
      return prisma.conversation.count({
        where: {
          orgId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      });
    }
    default:
      return 0;
  }
}

export class FeatureNotAllowedError extends Error {
  constructor(featureKey: string) {
    super(`This plan does not include the '${featureKey}' feature. Upgrade to use it.`);
  }
}

export class UsageLimitExceededError extends Error {
  constructor(serviceKey: string, remaining: number) {
    super(
      remaining > 0
        ? `Usage limit reached for ${serviceKey}. Only ${remaining} remaining in this billing period. Upgrade for more.`
        : `Usage limit reached for ${serviceKey}. Upgrade to continue.`
    );
  }
}

export async function requireFeature(orgId: string, featureKey: string) {
  const ok = await hasFeature(orgId, featureKey);
  if (!ok) throw new FeatureNotAllowedError(featureKey);
}

export async function requireUsageLimit(orgId: string, serviceKey: string, additionalQty = 1) {
  const check = await checkUsageLimit(orgId, serviceKey, additionalQty);
  if (!check.allowed) throw new UsageLimitExceededError(serviceKey, check.remaining);
  return check;
}
