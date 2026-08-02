import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [messageCounts, trendMessages, activeConversations, campaigns, reminderGroups] = await Promise.all([
      prisma.message.groupBy({
        by: ["direction"],
        where: {
          conversation: { orgId },
          createdAt: { gte: thirtyDaysAgo },
          isAiDraft: false,
        },
        _count: { _all: true },
      }),
      prisma.message.findMany({
        where: {
          conversation: { orgId },
          createdAt: { gte: fourteenDaysAgo },
          isAiDraft: false,
        },
        select: { createdAt: true, direction: true },
      }),
      prisma.conversation.findMany({
        where: { orgId, lastMessageAt: { gte: thirtyDaysAgo } },
        select: {
          id: true,
          messages: { where: { direction: "OUTBOUND", isAiDraft: false }, select: { id: true }, take: 1 },
        },
      }),
      prisma.campaign.findMany({
        where: { orgId, createdAt: { gte: thirtyDaysAgo } },
        select: { totalRecipients: true, sentCount: true, failedCount: true },
      }),
      prisma.reminder.groupBy({
        by: ["status"],
        where: { orgId, createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
    ]);

    const sent = messageCounts.find((m) => m.direction === "OUTBOUND")?._count._all ?? 0;
    const received = messageCounts.find((m) => m.direction === "INBOUND")?._count._all ?? 0;

    const trendByDay = new Map<string, { sent: number; received: number }>();
    for (let i = 13; i >= 0; i--) {
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
    const responseRate =
      activeConversations.length > 0 ? Math.round((respondedCount / activeConversations.length) * 100) : null;

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

    return NextResponse.json({
      messages: { sent, received },
      responseRate,
      activeConversationCount: activeConversations.length,
      dailyTrend,
      campaigns: campaignSummary,
      reminders: reminderSummary,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
