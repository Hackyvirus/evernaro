import { prisma } from "@/lib/prisma";

// Hard platform-wide safety cap for daily campaign volume. Per-plan campaign
// limits are enforced server-side via requireUsageLimit(orgId, "campaigns", qty)
// in src/lib/billing/entitlements.ts; this env override remains for platform
// analytics / observability only.
const DEFAULT_DAILY_CAMPAIGN_RECIPIENT_LIMIT = 2000;

export function dailyCampaignRecipientLimit(): number {
  const raw = process.env.DAILY_CAMPAIGN_RECIPIENT_LIMIT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_CAMPAIGN_RECIPIENT_LIMIT;
}

export async function dailyCampaignRecipientsUsed(orgId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.campaign.aggregate({
    where: { orgId, createdAt: { gte: since } },
    _sum: { totalRecipients: true },
  });
  return result._sum.totalRecipients ?? 0;
}
