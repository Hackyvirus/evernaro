import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId } from "@/lib/session";
import { dailyCampaignRecipientLimit } from "@/lib/usage-limits";

export const getPlatformAnalytics = cache(async () => {
  await requirePlatformAdminId();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limit = dailyCampaignRecipientLimit();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    orgs,
    messageCounts,
    usageAgg,
    activeSubscriptions,
    recentSubscriptions,
    subscriptionCounts,
    revenueAgg,
    revenueThisMonth,
    planBreakdown,
  ] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 1, select: { lastMessageAt: true } },
      },
    }),
    prisma.message.groupBy({
      by: ["direction"],
      where: { createdAt: { gte: thirtyDaysAgo }, isAiDraft: false },
      _count: { _all: true },
    }),
    prisma.campaign.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: since } },
      _sum: { totalRecipients: true },
    }),
    prisma.customerSubscription.findMany({
      where: { status: "ACTIVE" },
      select: { totalAmountInr: true, frequency: true },
    }),
    prisma.customerSubscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"] } },
      include: { plan: true, org: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.customerSubscription.groupBy({
      by: ["status"],
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"] } },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { amountInr: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amountInr: true },
    }),
    prisma.customerSubscription.groupBy({
      by: ["planId"],
      where: { status: "ACTIVE" },
      _sum: { totalAmountInr: true },
      _count: { _all: true },
    }),
  ]);

  const activeClientCount = orgs.filter(
    (o) => o.conversations[0] && new Date(o.conversations[0].lastMessageAt) >= activeSince
  ).length;

  const usageByOrg = new Map(usageAgg.map((u) => [u.orgId, u._sum.totalRecipients ?? 0]));
  const nearCapClients = orgs
    .filter((o) => (usageByOrg.get(o.id) ?? 0) >= limit * 0.8)
    .map((o) => ({ orgId: o.id, orgName: o.name, used: usageByOrg.get(o.id) ?? 0, limit }));

  const statusCount = (status: string) =>
    subscriptionCounts.find((c) => c.status === status)?._count._all ?? 0;
  const activeCount = statusCount("ACTIVE");
  const trialingCount = statusCount("TRIALING");
  const pastDueCount = statusCount("PAST_DUE");
  const pausedCount = statusCount("PAUSED");

  const mrrInr = activeSubscriptions.reduce(
    (sum, s) => sum + (s.frequency === "YEARLY" ? s.totalAmountInr / 12 : s.totalAmountInr),
    0
  );

  const planMap = new Map(planBreakdown.map((p) => [p.planId, p]));
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: Array.from(planMap.keys()) } },
    select: { id: true, name: true },
  });

  const revenueByPlan = plans
    .map((p) => {
      const agg = planMap.get(p.id);
      return {
        planId: p.id,
        planName: p.name,
        activeSubscriptions: agg?._count._all ?? 0,
        mrrInr: Math.round((agg?._sum.totalAmountInr ?? 0) / 12),
      };
    })
    .sort((a, b) => b.mrrInr - a.mrrInr);

  return {
    totalClients: orgs.length,
    activeClientCount,
    messagesSent: messageCounts.find((m) => m.direction === "OUTBOUND")?._count._all ?? 0,
    messagesReceived: messageCounts.find((m) => m.direction === "INBOUND")?._count._all ?? 0,
    nearCapClients,
    subscriptions: {
      active: activeCount,
      trialing: trialingCount,
      pastDue: pastDueCount,
      paused: pausedCount,
      recent: recentSubscriptions.map((s) => ({
        id: s.id,
        orgId: s.orgId,
        orgName: s.org.name,
        planName: s.plan.name,
        status: s.status,
        totalAmountInr: s.totalAmountInr,
        frequency: s.frequency,
        createdAt: s.createdAt.toISOString(),
      })),
    },
    revenue: {
      totalPaidInr: revenueAgg._sum.amountInr ?? 0,
      thisMonthInr: revenueThisMonth._sum.amountInr ?? 0,
      mrrInr: Math.round(mrrInr),
      arrInr: Math.round(mrrInr * 12),
      byPlan: revenueByPlan,
    },
  };
});

export const getPlatformOrganizations = cache(async (page = 1, limit = 50) => {
  await requirePlatformAdminId();
  const skip = (Math.max(1, page) - 1) * limit;
  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        users: { where: { role: "OWNER" }, take: 1, select: { name: true, email: true } },
        channels: { select: { type: true, isActive: true } },
        _count: { select: { contacts: true, conversations: true } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 1, select: { lastMessageAt: true } },
      },
    }),
    prisma.organization.count(),
  ]);

  return {
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
      monthlyFeeInr: org.monthlyFeeInr,
      owner: org.users[0] ?? null,
      channels: org.channels,
      contactCount: org._count.contacts,
      conversationCount: org._count.conversations,
      lastActivityAt: org.conversations[0]?.lastMessageAt?.toISOString() ?? null,
    })),
    total,
    page,
    limit,
  };
});

export const getPlatformInvoices = cache(async (page = 1, limit = 50) => {
  await requirePlatformAdminId();
  const OVERDUE_AFTER_DAYS = 7;
  const overdueBefore = new Date(Date.now() - OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const skip = (Math.max(1, page) - 1) * limit;

  const [invoices, total, paidAgg, pendingAgg, overdueCount] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { org: { select: { id: true, name: true } } },
    }),
    prisma.invoice.count(),
    prisma.invoice.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }),
    prisma.invoice.aggregate({ where: { status: "PENDING" }, _sum: { amountInr: true } }),
    prisma.invoice.count({ where: { status: "PENDING", createdAt: { lt: overdueBefore } } }),
  ]);

  return {
    invoices: invoices.map((inv) => ({
      id: inv.id,
      orgId: inv.org.id,
      orgName: inv.org.name,
      amountInr: inv.amountInr,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
    })),
    summary: {
      totalPaidInr: paidAgg._sum.amountInr ?? 0,
      totalPendingInr: pendingAgg._sum.amountInr ?? 0,
      overdueCount,
    },
    total,
    page,
    limit,
  };
});

export const getPlatformRateCards = cache(async () => {
  await requirePlatformAdminId();
  const cards = await prisma.whatsAppRateCard.findMany({ orderBy: { category: "asc" } });
  return cards.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }));
});

export const getPlatformOrganization = cache(async (id: string) => {
  await requirePlatformAdminId();
  const [org, lastConversation] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        businessProfile: { select: { industry: true, description: true } },
        channels: {
          select: {
            id: true,
            type: true,
            isActive: true,
            telegramBotUsername: true,
            emailAddress: true,
            whatsappAppName: true,
            whatsappSourceNumber: true,
            instagramUsername: true,
            twilioFromNumber: true,
            createdAt: true,
          },
        },
        invoices: { orderBy: { createdAt: "desc" }, take: 50 },
        _count: { select: { contacts: true, conversations: true, campaigns: true, reminders: true } },
      },
    }),
    prisma.conversation.findFirst({
      where: { orgId: id },
      orderBy: { lastMessageAt: "desc" },
      select: { lastMessageAt: true },
    }),
  ]);

  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
    monthlyFeeInr: org.monthlyFeeInr,
    industry: org.businessProfile?.industry ?? null,
    description: org.businessProfile?.description ?? null,
    users: org.users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    channels: org.channels.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    invoices: org.invoices.map((inv) => ({
      ...inv,
      createdAt: inv.createdAt.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
    })),
    contactCount: org._count.contacts,
    conversationCount: org._count.conversations,
    campaignCount: org._count.campaigns,
    reminderCount: org._count.reminders,
    lastActivityAt: lastConversation?.lastMessageAt?.toISOString() ?? null,
  };
});

export const getPlatformWallet = cache(async (id: string) => {
  await requirePlatformAdminId();
  const wallet = await prisma.whatsAppWallet.findUnique({ where: { orgId: id } });
  if (!wallet) return { wallet: null, transactions: [] };
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return {
    wallet: wallet ? { ...wallet, createdAt: wallet.createdAt.toISOString(), updatedAt: wallet.updatedAt.toISOString() } : null,
    transactions: transactions.map((tx) => ({ ...tx, createdAt: tx.createdAt.toISOString() })),
  };
});

export const getPlatformAuditLogs = cache(async (page = 1, limit = 50, orgId?: string, action?: string, targetType?: string) => {
  await requirePlatformAdminId();
  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  const skip = (Math.max(1, page) - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        org: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
        platformAdmin: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit };
});
