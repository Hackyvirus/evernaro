import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { cancelCampaignRecipientJob } from "@/lib/queue";

const campaignPatchSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "duplicate"]),
}).strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, orgId },
      include: {
        channel: { select: { type: true } },
        recipients: { include: { contact: true }, orderBy: { id: "asc" } },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const parsed = campaignPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { action } = parsed.data;

    const campaign = await prisma.campaign.findFirst({ where: { id, orgId } });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "pause") {
      if (campaign.status !== "SENDING" && campaign.status !== "SCHEDULED") {
        return NextResponse.json({ error: "Can only pause sending or scheduled campaigns" }, { status: 400 });
      }
      // Remove pending jobs from the queue.
      const pending = await prisma.campaignRecipient.findMany({ where: { campaignId: id, status: "PENDING" } });
      await Promise.allSettled(pending.map((r) => cancelCampaignRecipientJob(r.id)));
      const updated = await prisma.campaign.update({ where: { id }, data: { status: "PAUSED" } });
      await logAudit({ orgId, userId, action: "CAMPAIGN_CANCELLED", targetType: "Campaign", targetId: id, metadata: { action: "pause" } });
      return NextResponse.json({ campaign: updated });
    }

    if (action === "resume") {
      if (campaign.status !== "PAUSED") {
        return NextResponse.json({ error: "Can only resume paused campaigns" }, { status: 400 });
      }
      const pending = await prisma.campaignRecipient.findMany({ where: { campaignId: id, status: "PENDING" } });
      if (pending.length === 0) {
        const updated = await prisma.campaign.update({ where: { id }, data: { status: "COMPLETED" } });
        return NextResponse.json({ campaign: updated });
      }
      const { enqueueCampaignRecipient } = await import("@/lib/queue");
      await Promise.allSettled(pending.map((r) => enqueueCampaignRecipient(r.id)));
      const updated = await prisma.campaign.update({ where: { id }, data: { status: "SENDING" } });
      await logAudit({ orgId, userId, action: "CAMPAIGN_CREATED", targetType: "Campaign", targetId: id, metadata: { action: "resume" } });
      return NextResponse.json({ campaign: updated });
    }

    if (action === "cancel") {
      if (["COMPLETED", "CANCELLED", "FAILED"].includes(campaign.status)) {
        return NextResponse.json({ error: "Campaign already finished" }, { status: 400 });
      }
      const pending = await prisma.campaignRecipient.findMany({ where: { campaignId: id, status: "PENDING" } });
      await Promise.allSettled(pending.map((r) => cancelCampaignRecipientJob(r.id)));
      await prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "FAILED", error: "Cancelled by user" } });
      const updated = await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED", failedCount: { increment: pending.length } } });
      await logAudit({ orgId, userId, action: "CAMPAIGN_CANCELLED", targetType: "Campaign", targetId: id, metadata: { recipientsCancelled: pending.length } });
      return NextResponse.json({ campaign: updated });
    }

    if (action === "duplicate") {
      const recipients = await prisma.campaignRecipient.findMany({ where: { campaignId: id }, select: { contactId: true } });
      const newCampaign = await prisma.campaign.create({
        data: {
          orgId,
          channelId: campaign.channelId,
          name: `${campaign.name} (copy)`,
          description: campaign.description,
          messageTemplate: campaign.messageTemplate,
          whatsappTemplateId: campaign.whatsappTemplateId,
          status: "DRAFT",
          totalRecipients: recipients.length,
          recipients: { createMany: { data: recipients.map((r) => ({ contactId: r.contactId })) } },
        },
      });
      await logAudit({ orgId, userId, action: "CAMPAIGN_CREATED", targetType: "Campaign", targetId: newCampaign.id, metadata: { duplicatedFrom: id } });
      return NextResponse.json({ campaign: newCampaign });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
