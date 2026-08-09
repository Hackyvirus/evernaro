import { NextResponse, type NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { requireFeature, FeatureNotAllowedError } from "@/lib/billing/entitlements";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const RANGES: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    try {
      await requireFeature(orgId, "analytics");
      await requireActiveSubscription(orgId);
    } catch (err) {
      if (err instanceof FeatureNotAllowedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof SubscriptionSuspendedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      return NextResponse.json({ error: "Failed to verify plan limits" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const rangeKey = searchParams.get("range") ?? "30d";
    const days = RANGES[rangeKey] ?? 30;

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const trendDays = Math.min(days, 14);
    const trendStart = new Date(now.getTime() - trendDays * 24 * 60 * 60 * 1000);

    const [messageCounts, trendMessages, activeConversations, campaigns, reminderGroups, channelCounts, priorityCounts] = await Promise.all([
      prisma.message.groupBy({
        by: ["direction"],
        where: {
          conversation: { orgId },
          createdAt: { gte: startDate },
          isAiDraft: false,
        },
        _count: { _all: true },
      }),
      prisma.message.findMany({
        where: {
          conversation: { orgId },
          createdAt: { gte: trendStart },
          isAiDraft: false,
        },
        select: { createdAt: true, direction: true },
      }),
      prisma.conversation.findMany({
        where: { orgId, lastMessageAt: { gte: startDate } },
        select: {
          id: true,
          messages: { where: { direction: "OUTBOUND", isAiDraft: false }, select: { id: true }, take: 1 },
        },
      }),
      prisma.campaign.findMany({
        where: { orgId, createdAt: { gte: startDate } },
        select: { totalRecipients: true, sentCount: true, failedCount: true },
      }),
      prisma.reminder.groupBy({
        by: ["status"],
        where: { orgId, createdAt: { gte: startDate } },
        _count: { _all: true },
      }),
      prisma.conversation.groupBy({
        by: ["channelId"],
        where: { orgId, lastMessageAt: { gte: startDate } },
        _count: { _all: true },
      }),
      prisma.conversation.groupBy({
        by: ["priority"],
        where: { orgId, status: "OPEN" },
        _count: { _all: true },
      }),
    ]);

    const channels = await prisma.channel.findMany({
      where: { orgId },
      select: { id: true, type: true },
    });
    const channelById = new Map(channels.map((c) => [c.id, c.type]));

    const sent = messageCounts.find((m) => m.direction === "OUTBOUND")?._count._all ?? 0;
    const received = messageCounts.find((m) => m.direction === "INBOUND")?._count._all ?? 0;

    const trendByDay = new Map<string, { sent: number; received: number }>();
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trendByDay.set(dayKey(d), { sent: 0, received: 0 });
    }
    for (const m of trendMessages) {
      const key = dayKey(new Date(m.createdAt));
      const bucket = trendByDay.get(key);
      if (!bucket) continue;
      if (m.direction === "OUTBOUND") bucket.sent++;
      else bucket.received++;
    }
    const dailyTrend = Array.from(trendByDay.entries()).map(([date, counts]) => ({ date, ...counts }));

    const respondedCount = activeConversations.filter((c) => c.messages.length > 0).length;
    const responseRate = activeConversations.length > 0 ? Math.round((respondedCount / activeConversations.length) * 100) : null;

    const campaignSummary = campaigns.reduce(
      (acc, c) => ({
        campaignCount: acc.campaignCount + 1,
        totalRecipients: acc.totalRecipients + c.totalRecipients,
        totalSent: acc.totalSent + c.sentCount,
        totalFailed: acc.totalFailed + c.failedCount,
      }),
      { campaignCount: 0, totalRecipients: 0, totalSent: 0, totalFailed: 0 }
    );

    const reminderSummary = { PENDING: 0, SENT: 0, FAILED: 0, CANCELLED: 0 };
    for (const g of reminderGroups) {
      reminderSummary[g.status] = g._count._all;
    }

    const channelSummary = channelCounts.map((c) => ({
      channel: channelById.get(c.channelId) ?? "UNKNOWN",
      count: c._count._all,
    }));

    const openByPriority = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
      ...Object.fromEntries(priorityCounts.map((p) => [p.priority, p._count._all])),
    };

    return NextResponse.json({
      messages: { sent, received },
      responseRate,
      activeConversationCount: activeConversations.length,
      dailyTrend,
      campaigns: campaignSummary,
      reminders: reminderSummary,
      channels: channelSummary,
      openByPriority,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
