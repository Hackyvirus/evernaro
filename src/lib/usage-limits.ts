import { prisma } from "@/lib/prisma";

// Nothing else stops one org from running unbounded WhatsApp/Twilio/OpenAI
// spend through Campaigns — this is the guard for that. Override via env if
// a client's legitimate volume outgrows the default.
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
