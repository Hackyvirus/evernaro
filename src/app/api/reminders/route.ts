import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { enqueueReminder } from "@/lib/queue";
import { contactReachableOn } from "@/lib/channel-reachability";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const reminders = await prisma.reminder.findMany({
      where: { orgId },
      orderBy: { scheduledFor: "asc" },
      include: { contact: true, channel: { select: { type: true } } },
    });
    return NextResponse.json({ reminders });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load reminders" }, { status: 500 });
  }
}

const bodySchema = z.object({
  contactId: z.string().min(1),
  channelId: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.string().min(1), // ISO datetime
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  whatsappTemplateId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const orgId = await requireOrgId();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Contact, channel, message, and time are required" }, { status: 400 });
    }
    const { contactId, channelId, message, scheduledFor, recurrence, whatsappTemplateId } = parsed.data;

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

    if (channel.type === "WHATSAPP") {
      if (!whatsappTemplateId) {
        return NextResponse.json(
          { error: "WhatsApp reminders require an approved message template — a scheduled send is outside the active-conversation window Meta requires for free text." },
          { status: 400 }
        );
      }
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
        channelId,
        message,
        whatsappTemplateId: channel.type === "WHATSAPP" ? whatsappTemplateId : null,
        scheduledFor: scheduledDate,
        recurrence,
      },
    });

    await enqueueReminder(reminder.id, scheduledDate);

    return NextResponse.json({ ok: true, reminder });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
