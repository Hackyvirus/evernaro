"server-only";
import { prisma } from "@/lib/prisma";
import type { UsageSummary } from "./types";

export async function recordUsage(opts: {
  orgId: string;
  serviceKey: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  const service = await prisma.billableService.findUnique({ where: { key: opts.serviceKey } });
  if (!service) return null;

  return prisma.usageRecord.create({
    data: {
      orgId: opts.orgId,
      serviceId: service.id,
      quantity: opts.quantity ?? 1,
      metadata: (opts.metadata ?? {}) as never,
    },
  });
}

export async function getUsageForPeriod(
  orgId: string,
  serviceKey: string,
  periodStart: Date,
  periodEnd: Date
) {
  const service = await prisma.billableService.findUnique({ where: { key: serviceKey } });
  if (!service) return { used: 0 };

  const aggregate = await prisma.usageRecord.aggregate({
    where: {
      orgId,
      serviceId: service.id,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { quantity: true },
  });

  return { used: aggregate._sum.quantity ?? 0, serviceId: service.id };
}

async function getActualUsageForSummary(
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
    default:
      return getUsageForPeriod(orgId, serviceKey, periodStart, periodEnd).then((r) => r.used);
  }
}

export async function getOrgUsageSummary(orgId: string): Promise<UsageSummary[]> {
  const subscription = await prisma.customerSubscription.findFirst({
    where: { orgId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED", "INCOMPLETE"] } },
    include: { plan: { include: { limits: { include: { service: true } } } } },
  });

  if (!subscription) return [];

  const now = new Date();
  const periodStart = subscription.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = subscription.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const summaries: UsageSummary[] = [];
  for (const limit of subscription.plan.limits) {
    const used = await getActualUsageForSummary(orgId, limit.service.key, periodStart, periodEnd);
    const included = limit.includedQuantity;
    const remaining = Math.max(0, included - used);
    const overage = Math.max(0, used - included);
    const overageCost = limit.overagePriceInr ? overage * limit.overagePriceInr : 0;

    summaries.push({
      serviceId: limit.service.id,
      serviceKey: limit.service.key,
      serviceName: limit.service.name,
      unit: limit.service.unit,
      included,
      used,
      remaining,
      overage,
      overageCostInr: overageCost,
      percentUsed: included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0,
    });
  }

  return summaries;
}
