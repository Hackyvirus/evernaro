"server-only";

import { prisma } from "@/lib/prisma";
import { sendViaChannel, type WhatsAppTemplateSend } from "@/lib/send";
import { chooseChannelForContact } from "@/lib/channel-selection";
import { ChannelType, type Contact } from "@prisma/client";

export type QueueNotificationEvent = "joined" | "called" | "completed" | "cancelled";

// Meta requires a pre-approved template for any WhatsApp send outside the
// 24-hour window since the contact's last inbound message -- the normal case
// for a first-time patient who scans a queue QR code and has never messaged
// the business number before. Each event maps to its own approved template,
// named `queue_<event>` on the channel, submitted via Settings. Free-form
// text (below) remains the fallback when no approved template exists yet,
// or for orgs still relying on an open session window.
//
// "joined" and "called" have drifted off their obvious `queue_<event>`
// names because Gupshup's backend repeatedly got stuck deleting the old
// name ("New English content can't be added while the existing English
// content is being deleted"): queue_joined -> queue_checkin -> queue_checkedin,
// and queue_called -> queue_yourturn. Same body and params each time --
// only the name on the channel changes. If one of these gets stuck again,
// pick a fresh name and update just this map.
const QUEUE_TEMPLATE_NAMES: Record<QueueNotificationEvent, string> = {
  joined: "queue_checkedin",
  called: "queue_yourturn",
  completed: "queue_completed",
  cancelled: "queue_cancelled",
};

async function chooseQueueTemplate(channelId: string, event: QueueNotificationEvent) {
  return prisma.whatsAppTemplate.findFirst({
    where: { channelId, status: "APPROVED", name: QUEUE_TEMPLATE_NAMES[event] },
  });
}

function buildQueueTemplateParams(
  event: QueueNotificationEvent,
  firstName: string,
  meta: {
    token: string;
    position: number;
    estimatedWaitMin: number;
    businessName: string;
    verificationCode?: string | null;
  }
): string[] {
  switch (event) {
    case "joined":
      return [firstName, meta.businessName, meta.token, String(meta.estimatedWaitMin)];
    case "called":
      return [firstName, meta.businessName, meta.token, meta.verificationCode ?? ""];
    case "completed":
    case "cancelled":
      return [firstName, meta.businessName];
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
    const channel = await chooseChannelForContact(orgId, contact);
    if (!channel) return;

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

    let whatsappTemplate: WhatsAppTemplateSend | undefined;
    if (channel.type === ChannelType.WHATSAPP) {
      const template = await chooseQueueTemplate(channel.id, event);
      if (template?.gupshupTemplateId) {
        whatsappTemplate = {
          gupshupTemplateId: template.gupshupTemplateId,
          category: template.category,
          params: buildQueueTemplateParams(event, firstName, meta),
        };
      }
    }

    await sendViaChannel(channel, contact, text, undefined, whatsappTemplate, {
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
    const channel = await chooseChannelForContact(orgId, contact);
    if (!channel) return;

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
