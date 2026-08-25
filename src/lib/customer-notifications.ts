"server-only";

import { prisma } from "@/lib/prisma";
import { sendViaChannel } from "@/lib/send";
import { ChannelType, type Contact } from "@prisma/client";

export type QueueNotificationEvent = "joined" | "called" | "completed" | "cancelled";

async function chooseChannel(orgId: string) {
  return prisma.channel.findFirst({
    where: {
      orgId,
      isActive: true,
      type: { in: [ChannelType.WHATSAPP, ChannelType.TELEGRAM, ChannelType.EMAIL] },
    },
    orderBy: { type: "asc" },
  });
}

function isReachable(contact: Contact, channelType: ChannelType): boolean {
  switch (channelType) {
    case ChannelType.WHATSAPP:
      return Boolean(contact.phone);
    case ChannelType.TELEGRAM:
      return Boolean(contact.telegramChatId);
    case ChannelType.EMAIL:
      return Boolean(contact.email);
    default:
      return false;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Sends a best-effort queue notification to the customer's preferred channel.
 * Failures are logged but never block the core queue operation.
 */
export async function sendQueueNotification(
  orgId: string,
  contact: Contact,
  event: QueueNotificationEvent,
  meta: {
    token: string;
    position: number;
    estimatedWaitMin: number;
    queueName: string;
    businessName: string;
    serviceName?: string | null;
    staffName?: string | null;
    verificationCode?: string | null;
  }
) {
  try {
    const channel = await chooseChannel(orgId);
    if (!channel || !isReachable(contact, channel.type)) return;

    const firstName = (contact.name ?? "there").split(" ")[0];
    let text = "";

    switch (event) {
      case "joined":
        text =
          `Hi ${firstName}, you're checked in at ${meta.businessName}. ` +
          `Your token is ${meta.token} and your position is ${meta.position}. ` +
          `Estimated wait: ${meta.estimatedWaitMin} min.`;
        break;
      case "called":
        text =
          `Hi ${firstName}, it's your turn at ${meta.businessName}! ` +
          `Please proceed${meta.staffName ? ` to ${meta.staffName}` : ""}.` +
          (meta.serviceName ? ` Service: ${meta.serviceName}.` : "") +
          ` Token: ${meta.token}.` +
          (meta.verificationCode ? ` Show this code to staff: ${meta.verificationCode}.` : "");
        break;
      case "completed":
        text = `Hi ${firstName}, thank you for visiting ${meta.businessName}. We hope to see you again soon!`;
        break;
      case "cancelled":
        text = `Hi ${firstName}, your queue entry at ${meta.businessName} has been cancelled. You can rejoin anytime.`;
        break;
    }

    if (!text) return;

    await sendViaChannel(channel, contact, text, undefined, undefined, {
      type: "REMINDER",
      id: `${meta.token}-${event}`,
    });
  } catch (err) {
    console.error(`[customer-notifications] queue ${event} failed:`, err);
  }
}

/**
 * Sends a best-effort appointment booking confirmation.
 */
export async function sendAppointmentConfirmation(
  orgId: string,
  contact: Contact,
  appointment: {
    startsAt: Date;
    service?: { name: string } | null;
    staff?: { name: string } | null;
  },
  businessName: string
) {
  try {
    const channel = await chooseChannel(orgId);
    if (!channel || !isReachable(contact, channel.type)) return;

    const firstName = (contact.name ?? "there").split(" ")[0];
    const serviceName = appointment.service?.name ?? "appointment";
    const staffPart = appointment.staff?.name ? ` with ${appointment.staff.name}` : "";
    const text =
      `Hi ${firstName}, your ${serviceName}${staffPart} at ${businessName} is confirmed ` +
      `for ${formatDate(appointment.startsAt)} at ${formatTime(appointment.startsAt)}. ` +
      `Reply to this message if you need to reschedule.`;

    await sendViaChannel(channel, contact, text, undefined, undefined, {
      type: "REMINDER",
      id: `${contact.id}-${appointment.startsAt.toISOString()}`,
    });
  } catch (err) {
    console.error("[customer-notifications] appointment confirmation failed:", err);
  }
}

async function sendBusinessEmail(orgId: string, subject: string, body: string) {
  try {
    const owner = await prisma.user.findFirst({
      where: { orgId, role: { in: ["OWNER", "ADMIN"] }, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { email: true, name: true },
    });
    if (!owner?.email) return;

    const { sendEmail } = await import("./email");
    await sendEmail({
      to: owner.email,
      subject,
      text: body,
      from: process.env.EMAIL_FROM || "Evernaro <noreply@evernaro.com>",
    });
  } catch (err) {
    console.error("[customer-notifications] business email failed:", err);
  }
}

export async function sendBusinessQueueNotification(
  orgId: string,
  entry: { token: string; contact: { name: string | null; phone: string | null }; queue: { name: string } },
  businessName: string,
  isAfterHours = false
) {
  try {
    const when = isAfterHours ? "after hours" : "just now";
    const body =
      `A customer joined your queue ${when} at ${businessName}.\n\n` +
      `Queue: ${entry.queue.name}\n` +
      `Token: ${entry.token}\n` +
      `Customer: ${entry.contact.name ?? "Unknown"}${entry.contact.phone ? ` (${entry.contact.phone})` : ""}\n` +
      (isAfterHours ? "This is an after-hours request and will be visible when your business is open." : "");
    await sendBusinessEmail(orgId, `New queue entry at ${businessName}`, body);
  } catch (err) {
    console.error("[customer-notifications] business queue notification failed:", err);
  }
}

export async function sendBusinessAppointmentNotification(
  orgId: string,
  appointment: {
    startsAt: Date;
    service?: { name: string } | null;
    contact: { name: string | null; phone: string | null };
  },
  businessName: string
) {
  try {
    const body =
      `A new appointment was booked at ${businessName}.\n\n` +
      `Service: ${appointment.service?.name ?? "Appointment"}\n` +
      `Date/Time: ${formatDate(appointment.startsAt)} at ${formatTime(appointment.startsAt)}\n` +
      `Customer: ${appointment.contact.name ?? "Unknown"}${appointment.contact.phone ? ` (${appointment.contact.phone})` : ""}`;
    await sendBusinessEmail(orgId, `New appointment at ${businessName}`, body);
  } catch (err) {
    console.error("[customer-notifications] business appointment notification failed:", err);
  }
}
