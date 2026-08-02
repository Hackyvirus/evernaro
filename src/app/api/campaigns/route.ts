import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { enqueueCampaignRecipient } from "@/lib/queue";
import { CHANNEL_IDENTIFIER_FIELD } from "@/lib/channel-reachability";
import { dailyCampaignRecipientLimit, dailyCampaignRecipientsUsed } from "@/lib/usage-limits";
import { whatsappSendRequiresTemplate } from "@/lib/whatsapp-template-validation";

export async function GET() {
  try {
    const orgId = await requireOrgId();
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
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }
}

const bodySchema = z.object({
  name: z.string().min(1),
  channelId: z.string().min(1),
  messageTemplate: z.string().min(1),
  whatsappTemplateId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Name, channel, and message are required" }, { status: 400 });
    }
    const { name, channelId, messageTemplate, whatsappTemplateId } = parsed.data;

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
    const contacts = await prisma.contact.findMany({
      where: { orgId, [identifierField]: { not: null } },
      select: { id: true },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: `No contacts reachable on this channel yet` },
        { status: 400 }
      );
    }

    const limit = dailyCampaignRecipientLimit();
    const usedToday = await dailyCampaignRecipientsUsed(orgId);
    if (usedToday + contacts.length > limit) {
      return NextResponse.json(
        {
          error: `This would send to ${contacts.length} contacts, but only ${Math.max(limit - usedToday, 0)} remain of your ${limit}/day campaign limit. Contact support to raise it.`,
        },
        { status: 429 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        channelId,
        name,
        messageTemplate,
        whatsappTemplateId: whatsappTemplateId ?? null,
        status: "SENDING",
        totalRecipients: contacts.length,
        recipients: { createMany: { data: contacts.map((c) => ({ contactId: c.id })) } },
      },
      include: { recipients: true },
    });

    // Enqueue every recipient independently — one Redis hiccup must not abort
    // the rest (Promise.allSettled, not a sequential awaited loop). Recipients
    // that fail to enqueue are marked FAILED immediately rather than left
    // PENDING forever with no job behind them, which would otherwise stick
    // the campaign in SENDING permanently (the worker only ever flips it to
    // COMPLETED when the PENDING count reaches zero).
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
      // Nothing was enqueued at all, so no worker job will ever run the
      // completion check — reconcile the campaign status here instead.
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
    }

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to create campaign";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
