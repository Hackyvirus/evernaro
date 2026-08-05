import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { enqueueReminder } from "@/lib/queue";
import { contactReachableOn } from "@/lib/channel-reachability";
import { whatsappSendRequiresTemplate } from "@/lib/whatsapp-template-validation";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const reminders = await prisma.reminder.findMany({
      where: { orgId },
      orderBy: { scheduledFor: "asc" },
      include: { contact: true, channel: { select: { type: true } }, assignedTo: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ reminders });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load reminders" }, { status: 500 });
  }
}

const bodySchema = z.object({
  contactId: z.string().min(1),
  title: z.string().optional(),
  type: z.enum(["APPOINTMENT", "PAYMENT", "FOLLOW_UP", "CALLBACK", "CUSTOM"]).default("CUSTOM"),
  channelId: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.string().min(1),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  whatsappTemplateId: z.string().optional(),
  assignedToId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Contact, channel, message, and time are required" }, { status: 400 });
    }
    const { contactId, title, type, channelId, message, scheduledFor, recurrence, whatsappTemplateId, assignedToId } = parsed.data;

    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "scheduledFor must be a valid future time" }, { status: 400 });
    }

    const [contact, channel] = await Promise.all([
      prisma.contact.findFirst({ where: { id: contactId, orgId } }),
      prisma.channel.findFirst({ where: { id: channelId, orgId } }),
    ]);
    if (!contact || !channel) {
      return NextResponse.json({ error: "Contact or channel not found" }, { status: 404 });
    }
    if (!contactReachableOn(channel.type, contact)) {
      return NextResponse.json(
        { error: `This contact has no ${channel.type.toLowerCase()} identifier on file — can't schedule this reminder.` },
        { status: 400 }
      );
    }

    if (whatsappSendRequiresTemplate(channel.type, whatsappTemplateId)) {
      return NextResponse.json(
        { error: "WhatsApp reminders require an approved message template — a scheduled send is outside the active-conversation window Meta requires for free text." },
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

    const reminder = await prisma.reminder.create({
      data: {
        orgId,
        contactId,
        title: title ?? null,
        type,
        channelId,
        message,
        whatsappTemplateId: channel.type === "WHATSAPP" ? whatsappTemplateId : null,
        assignedToId: assignedToId || null,
        scheduledFor: scheduledDate,
        recurrence,
      },
    });

    await enqueueReminder(reminder.id, scheduledDate);

    await logAudit({
      orgId,
      userId,
      action: "REMINDER_CREATED",
      targetType: "Reminder",
      targetId: reminder.id,
      metadata: { channelType: channel.type, scheduledFor, recurrence },
    });

    return NextResponse.json({ ok: true, reminder });
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
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
