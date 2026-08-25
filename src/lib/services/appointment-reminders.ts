"server-only";

import { prisma } from "@/lib/prisma";
import { enqueueReminder } from "@/lib/queue";
import { chooseChannelForContact } from "@/lib/channel-selection";
import { ChannelType } from "@prisma/client";

function minutesBefore(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60000);
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

  const reminderTimes = [
    { label: "24h", at: minutesBefore(startsAt, 24 * 60) },
    { label: "2h", at: minutesBefore(startsAt, 120) },
  ];

  let whatsappTemplateId: string | undefined;
  if (channel.type === ChannelType.WHATSAPP) {
    const template = await chooseWhatsAppTemplate(channel.id);
    if (template) {
      whatsappTemplateId = template.id;
    }
    // If no approved template exists, we fall back to free text. This works
    // within Meta's 24-hour customer-service window; outside the window the
    // send will fail gracefully and the failure is logged.
  }

  for (const { at, label } of reminderTimes) {
    if (at.getTime() <= Date.now()) continue;

    const message =
      label === "24h"
        ? `Hi {{name}}, reminder: your ${serviceName} appointment is on ${startsAt.toLocaleDateString()} at ${startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Reply to confirm or reschedule.`
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
      },
    });

    await enqueueReminder(reminder.id, at);
  }
}
