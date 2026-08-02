import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { dailyCampaignRecipientLimit, dailyCampaignRecipientsUsed } from "@/lib/usage-limits";

const ACTIVE_WITHIN_DAYS = 7;

export async function GET() {
  try {
    await requirePlatformAdminId();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeSince = new Date(Date.now() - ACTIVE_WITHIN_DAYS * 24 * 60 * 60 * 1000);

    const [orgs, messageCounts] = await Promise.all([
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          conversations: {
            orderBy: { lastMessageAt: "desc" },
            take: 1,
            select: { lastMessageAt: true },
          },
        },
      }),
      prisma.message.groupBy({
        by: ["direction"],
        where: { createdAt: { gte: thirtyDaysAgo }, isAiDraft: false },
        _count: { _all: true },
      }),
    ]);

    const activeClientCount = orgs.filter(
      (o) => o.conversations[0] && new Date(o.conversations[0].lastMessageAt) >= activeSince
    ).length;

    const limit = dailyCampaignRecipientLimit();
    const usageEntries = await Promise.all(
      orgs.map(async (o) => ({
        orgId: o.id,
        orgName: o.name,
        used: await dailyCampaignRecipientsUsed(o.id),
      }))
    );
    const nearCapClients = usageEntries
      .filter((e) => e.used >= limit * 0.8)
      .map((e) => ({ orgId: e.orgId, orgName: e.orgName, used: e.used, limit }));

    return NextResponse.json({
      totalClients: orgs.length,
      activeClientCount,
      messagesSent: messageCounts.find((m) => m.direction === "OUTBOUND")?._count._all ?? 0,
      messagesReceived: messageCounts.find((m) => m.direction === "INBOUND")?._count._all ?? 0,
      nearCapClients,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load platform analytics" }, { status: 500 });
  }
}
