"server-only";

import { prisma } from "@/lib/prisma";
import { enqueueReminder } from "@/lib/queue";
import { chooseChannelForContact } from "@/lib/channel-selection";
import { ChannelType } from "@prisma/client";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";

function minutesBefore(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60000);
}

// Ordered body params for the "*reminder*" WhatsApp template. The template
// MUST be written with exactly these five variables in this order:
//   {{1}} patient name   {{2}} service   {{3}} business
//   {{4}} appointment date   {{5}} appointment time
// The same template (and the same params) serves both the 24h and the 2h
// reminder -- it states the absolute date/time, which reads correctly at
// either lead time. buildAppointmentReminderParams is the single source of
// truth for that order; keep it and the approved template in lockstep.
export function buildAppointmentReminderParams(args: {
  contactName: string | null;
  serviceName: string;
  businessName: string;
  startsAt: Date;
  timeZone: string;
}): string[] {
  return [
    args.contactName?.trim() || "there",
    args.serviceName,
    args.businessName,
    formatDateInTimezone(args.startsAt, args.timeZone),
    formatTimeInTimezone(args.startsAt, args.timeZone),
  ];
}

async function chooseWhatsAppTemplate(channelId: string) {
  return prisma.whatsAppTemplate.findFirst({
    where: { channelId, status: "APPROVED", name: { contains: "reminder", mode: "insensitive" } },
  });
}

export async function scheduleAppointmentReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { contact: true, service: true, staff: true, org: { include: { channels: { where: { isActive: true } } } } },
  });

  if (!appointment) return;

  const contact = appointment.contact;
  const channel = await chooseChannelForContact(appointment.orgId, contact);
  if (!channel) return;
  const serviceName = appointment.service?.name ?? "your appointment";
  const startsAt = appointment.startsAt;
  const timeZone = appointment.org.timezone;
  const dateStr = formatDateInTimezone(startsAt, timeZone);
  const timeStr = formatTimeInTimezone(startsAt, timeZone);

  const reminderTimes = [
    { label: "24h", at: minutesBefore(startsAt, 24 * 60) },
    { label: "2h", at: minutesBefore(startsAt, 120) },
  ];

  let whatsappTemplateId: string | undefined;
  let templateParams: string[] = [];
  if (channel.type === ChannelType.WHATSAPP) {
    const template = await chooseWhatsAppTemplate(channel.id);
    if (template) {
      whatsappTemplateId = template.id;
      templateParams = buildAppointmentReminderParams({
        contactName: contact.name,
        serviceName,
        businessName: appointment.org.name,
        startsAt,
        timeZone,
      });
    }
    // If no approved template exists, we fall back to free text. This works
    // within Meta's 24-hour customer-service window; outside the window the
    // send will fail gracefully and the failure is logged.
  }

  for (const { at, label } of reminderTimes) {
    if (at.getTime() <= Date.now()) continue;

    const message =
      label === "24h"
        ? `Hi {{name}}, reminder: your ${serviceName} appointment is on ${dateStr} at ${timeStr}. Reply to confirm or reschedule.`
        : `Hi {{name}}, your ${serviceName} appointment is in 2 hours. See you soon!`;

    const reminder = await prisma.reminder.create({
      data: {
        orgId: appointment.orgId,
        contactId: contact.id,
        channelId: channel.id,
        title: `${serviceName} reminder (${label})`,
        type: "APPOINTMENT",
        message,
        scheduledFor: at,
        whatsappTemplateId: whatsappTemplateId ?? null,
        templateParams,
      },
    });

    await enqueueReminder(reminder.id, at);
  }
}
