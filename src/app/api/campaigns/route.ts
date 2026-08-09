import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { enqueueCampaignRecipient } from "@/lib/queue";
import { CHANNEL_IDENTIFIER_FIELD } from "@/lib/channel-reachability";
import { whatsappSendRequiresTemplate } from "@/lib/whatsapp-template-validation";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";
import {
  requireFeature,
  requireUsageLimit,
  FeatureNotAllowedError,
  UsageLimitExceededError,
} from "@/lib/billing/entitlements";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const campaigns = await prisma.campaign.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { channel: { select: { type: true } } },
    });
    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  channelId: z.string().min(1),
  messageTemplate: z.string().min(1).max(4096),
  whatsappTemplateId: z.string().optional(),
  timezone: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  audience: z.union([
    z.literal("all"),
    z.object({ tag: z.string().min(1) }),
    z.object({ contactIds: z.array(z.string().min(1)).min(1) }),
  ]).optional(),
});

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { name, description, channelId, messageTemplate, whatsappTemplateId, timezone, scheduledAt, audience } = parsed.data;

    const channel = await prisma.channel.findFirst({ where: { id: channelId, orgId } });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (channel.type === "VOICE") {
      return NextResponse.json(
        { error: "Voice calls can't be sent as bulk campaigns — schedule individual reminder calls instead." },
        { status: 400 }
      );
    }

    if (whatsappSendRequiresTemplate(channel.type, whatsappTemplateId)) {
      return NextResponse.json(
        { error: "WhatsApp campaigns require an approved message template — free text is rejected by Meta outside an active conversation." },
        { status: 400 }
      );
    }
    if (channel.type === "WHATSAPP") {
      const template = await prisma.whatsAppTemplate.findFirst({
        where: { id: whatsappTemplateId, channelId: channel.id, status: "APPROVED" },
      });
      if (!template) {
        return NextResponse.json(
          { error: "That template isn't approved yet — check its status in Settings before using it." },
          { status: 400 }
        );
      }
    }

    const identifierField = CHANNEL_IDENTIFIER_FIELD[channel.type];
    const audienceInput = audience ?? "all";
    const where: { orgId: string; [key: string]: unknown } = {
      orgId,
      [identifierField]: { not: null },
      marketingOptOut: false,
    };
    if (typeof audienceInput === "object" && "tag" in audienceInput) {
      where.tags = { has: audienceInput.tag };
    } else if (typeof audienceInput === "object" && "contactIds" in audienceInput) {
      where.id = { in: audienceInput.contactIds };
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: `No contacts reachable on this channel yet` },
        { status: 400 }
      );
    }

    try {
      await requireFeature(orgId, "broadcast_campaigns");
      await requireUsageLimit(orgId, "campaigns", contacts.length);
    } catch (err) {
      if (err instanceof FeatureNotAllowedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof UsageLimitExceededError) {
        return NextResponse.json({ error: err.message }, { status: 402 });
      }
      return NextResponse.json({ error: "Failed to verify plan limits" }, { status: 500 });
    }

    const now = new Date();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const isScheduled = scheduledDate && scheduledDate.getTime() > now.getTime();
    const status = isScheduled ? "SCHEDULED" : "SENDING";

    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        channelId,
        name,
        description: description ?? null,
        messageTemplate,
        whatsappTemplateId: whatsappTemplateId ?? null,
        status,
        scheduledAt: scheduledDate ?? null,
        timezone: timezone ?? "Asia/Kolkata",
        totalRecipients: contacts.length,
        recipients: { createMany: { data: contacts.map((c) => ({ contactId: c.id })) } },
      },
      include: { recipients: true },
    });

    if (!isScheduled) {
      // Enqueue every recipient independently — one Redis hiccup must not abort
      // the rest (Promise.allSettled, not a sequential awaited loop).
      const results = await Promise.allSettled(
        campaign.recipients.map((r) => enqueueCampaignRecipient(r.id))
      );
      const failedIds = campaign.recipients
        .filter((_, i) => results[i].status === "rejected")
        .map((r) => r.id);

      if (failedIds.length > 0) {
        await prisma.campaignRecipient.updateMany({
          where: { id: { in: failedIds } },
          data: { status: "FAILED", error: "Failed to queue for sending" },
        });
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: failedIds.length } },
        });
      }
      if (failedIds.length === campaign.recipients.length) {
        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
      }
    } else {
      // Schedule each recipient job with BullMQ delay.
      const delayMs = scheduledDate.getTime() - now.getTime();
      await Promise.allSettled(
        campaign.recipients.map((r) => enqueueCampaignRecipient(r.id, delayMs))
      );
    }

    await logAudit({
      orgId,
      userId,
      action: "CAMPAIGN_CREATED",
      targetType: "Campaign",
      targetId: campaign.id,
      metadata: { name, channelType: channel.type, totalRecipients: campaign.totalRecipients, scheduled: isScheduled },
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to create campaign";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
