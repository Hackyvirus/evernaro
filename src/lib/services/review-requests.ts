"server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enqueueReminder } from "@/lib/queue";
import { ChannelType } from "@prisma/client";
import { chooseChannelForContact } from "@/lib/channel-selection";

const REVIEW_TOKEN_TTL_HOURS = 72;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to sign review links");
  return secret;
}

export type ReviewSubjectType = "appointment" | "queueEntry";
export type ReviewSubject = { type: ReviewSubjectType; id: string };

// Subject type is encoded in the signed payload (not inferred at the call
// site) so a token can only ever be redeemed against the kind of record it
// was actually issued for -- an appointment-review link can't accidentally
// verify a queue entry, and vice versa.
export function generateReviewToken(contactId: string, subject: ReviewSubject) {
  const secret = getSecret();
  const expiresAt = Date.now() + REVIEW_TOKEN_TTL_HOURS * 60 * 60 * 1000;
  const payload = `${contactId}:${subject.type}:${subject.id}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${Buffer.from(payload).toString("base64url")}.${signature}`, expiresAt: new Date(expiresAt) };
}

export function verifyReviewToken(token: string): { contactId: string; subject: ReviewSubject } | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf-8");
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const [contactId, subjectType, subjectId, expiresAtStr] = payload.split(":");
  if (!contactId || !subjectId || !expiresAtStr) return null;
  if (subjectType !== "appointment" && subjectType !== "queueEntry") return null;
  if (Date.now() > Number(expiresAtStr)) return null;

  return { contactId, subject: { type: subjectType, id: subjectId } };
}

async function chooseWhatsAppTemplate(channelId: string) {
  return prisma.whatsAppTemplate.findFirst({
    where: { channelId, status: "APPROVED", name: { contains: "review", mode: "insensitive" } },
  });
}

// Ordered body params for the "*review*" WhatsApp template. The template MUST
// be written with exactly these three variables in this order:
//   {{1}} patient name   {{2}} service   {{3}} review link
// Keep this and the approved template in lockstep.
export function buildReviewRequestParams(args: {
  contactName: string | null;
  serviceName: string;
  reviewUrl: string;
}): string[] {
  return [args.contactName?.trim() || "there", args.serviceName, args.reviewUrl];
}

export async function scheduleReviewRequest(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { contact: true, service: true, org: true },
  });
  if (!appointment || appointment.status !== "COMPLETED") return;

  const channel = await chooseChannelForContact(appointment.orgId, appointment.contact);
  if (!channel) return;

  const { token } = generateReviewToken(appointment.contactId, { type: "appointment", id: appointment.id });
  const reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/business/${appointment.org.slug}/review?t=${token}`;
  const serviceName = appointment.service?.name ?? "your visit";
  const message = `Hi {{name}}, how was ${serviceName}? Please rate your experience here: ${reviewUrl}`;

  let whatsappTemplateId: string | undefined;
  let templateParams: string[] = [];
  if (channel.type === ChannelType.WHATSAPP) {
    const template = await chooseWhatsAppTemplate(channel.id);
    if (!template) return;
    whatsappTemplateId = template.id;
    templateParams = buildReviewRequestParams({
      contactName: appointment.contact.name,
      serviceName,
      reviewUrl,
    });
  }

  const scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours after completion

  const reminder = await prisma.reminder.create({
    data: {
      orgId: appointment.orgId,
      contactId: appointment.contactId,
      channelId: channel.id,
      title: "Review request",
      type: "FOLLOW_UP",
      message,
      scheduledFor,
      whatsappTemplateId: whatsappTemplateId ?? null,
      templateParams,
    },
  });

  await enqueueReminder(reminder.id, scheduledFor);
}
