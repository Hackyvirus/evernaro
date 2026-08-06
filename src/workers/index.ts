// Standalone worker process — run with `npm run worker`.
// Next.js API routes are request/response only; bulk sends and scheduled
// reminders need a long-lived process to consume BullMQ jobs, so this file
// is that process. Deploy it separately from the web app (e.g. a small
// background worker service) alongside the web app in production.

import * as Sentry from "@sentry/node";
import { Worker, type Job } from "bullmq";
import fs from "node:fs";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendViaChannel } from "../lib/send";
import { InsufficientWalletBalanceError } from "../lib/whatsapp-wallet";
import { twilioPlaceCall } from "../lib/voice";
import { channelWebhookSecret } from "../lib/webhook-secret";
import { decryptSecret } from "../lib/crypto";
import { nextOccurrence } from "../lib/recurrence";
import { requireActiveSubscription } from "../lib/subscription";
import {
  CAMPAIGN_SEND_QUEUE,
  REMINDER_SEND_QUEUE,
  enqueueReminder,
  type CampaignSendJob,
  type ReminderSendJob,
} from "../lib/queue";

// This process runs outside Next.js (`npm run worker`), so it isn't covered
// by src/instrumentation.ts — needs its own Sentry init. No-op until
// SENTRY_DSN is set.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
}

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error("Uncaught exception in worker:", err);
});
process.on("unhandledRejection", (err) => {
  Sentry.captureException(err);
  console.error("Unhandled rejection in worker:", err);
});

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
let isShuttingDown = false;

const healthFile = process.env.WORKER_HEALTH_FILE || "/tmp/worker.health";
const heartbeat = setInterval(() => {
  try {
    fs.writeFileSync(healthFile, String(Date.now()));
  } catch (err) {
    console.error("Failed to write worker heartbeat:", err);
  }
}, 5000);

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}, shutting down worker gracefully...`);

  clearInterval(heartbeat);
  try {
    fs.unlinkSync(healthFile);
  } catch {}

  try {
    await Promise.all([campaignWorker.close(), reminderWorker.close()]);
  } catch (err) {
    console.error("Error closing BullMQ workers:", err);
  }

  try {
    await redisConnection.quit();
    await prisma.$disconnect();
  } catch (err) {
    console.error("Error during worker cleanup:", err);
  }

  process.exit(0);
}

SHUTDOWN_SIGNALS.forEach((signal) => process.on(signal, shutdown));

const CAMPAIGN_RATE_PER_SECOND = Number(process.env.CAMPAIGN_RATE_PER_SECOND || 5);
const CAMPAIGN_WORKER_CONCURRENCY = Number(process.env.CAMPAIGN_WORKER_CONCURRENCY || 5);
const REMINDER_WORKER_CONCURRENCY = Number(process.env.REMINDER_WORKER_CONCURRENCY || 10);

function renderTemplate(template: string, name: string | null) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, name?.trim() || "there");
}

async function processCampaignJob(job: Job<CampaignSendJob>) {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: job.data.campaignRecipientId },
    include: {
      contact: true,
      campaign: { include: { channel: true, whatsappTemplate: true } },
    },
  });
  if (!recipient || recipient.status !== "PENDING") return;

  // Transition scheduled campaigns to sending when the first recipient job runs.
  if (recipient.campaign.status === "SCHEDULED") {
    await prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: { status: "SENDING" },
    });
  }

  const text = renderTemplate(recipient.campaign.messageTemplate, recipient.contact.name);
  const wat = recipient.campaign.whatsappTemplate;

  let sendError: string | null = null;
  try {
    if (wat && !wat.gupshupTemplateId) {
      throw new Error("Template was never confirmed by Gupshup — check its status in Settings");
    }
    await sendViaChannel(
      recipient.campaign.channel,
      recipient.contact,
      text,
      undefined,
      wat?.gupshupTemplateId
        ? {
            gupshupTemplateId: wat.gupshupTemplateId,
            params: [recipient.contact.name?.trim() || "there"],
            category: wat.category,
          }
        : undefined,
      { type: "CAMPAIGN_RECIPIENT", id: recipient.id }
    );
  } catch (err) {
    sendError =
      err instanceof InsufficientWalletBalanceError
        ? "Insufficient WhatsApp balance — top up the wallet from Billing"
        : err instanceof Error
          ? err.message
          : "Send failed";
    console.error(`Campaign recipient ${recipient.id} failed:`, err);
  }

  // Atomic update: mark the recipient, increment the campaign counter, and
  // finalize the campaign if no pending recipients remain. This prevents race
  // conditions when multiple workers process the same campaign concurrently.
  await prisma.$transaction(async (tx) => {
    await tx.campaignRecipient.update({
      where: { id: recipient.id },
      data: sendError
        ? { status: "FAILED", error: sendError }
        : { status: "SENT", sentAt: new Date() },
    });

    await tx.campaign.update({
      where: { id: recipient.campaignId },
      data: sendError ? { failedCount: { increment: 1 } } : { sentCount: { increment: 1 } },
    });

    const remaining = await tx.campaignRecipient.count({
      where: { campaignId: recipient.campaignId, status: "PENDING" },
    });
    if (remaining === 0) {
      await tx.campaign.update({
        where: { id: recipient.campaignId },
        data: { status: "COMPLETED" },
      });
    }
  });
}

// Places the actual call for a VOICE-channel reminder and logs it to
// CallLog. Deliberately not part of sendViaChannel — voice is reachable only
// through reminders (a specific contact, a specific scheduled time), never
// through bulk Campaigns, to keep this to the plan's low-risk use case
// (appointment/payment reminders to existing contacts, not cold calling).
async function placeReminderCall(reminder: {
  id: string;
  orgId: string;
  contactId: string;
  channelId: string;
  message: string;
}, contact: { phone: string | null }, channel: { isActive: boolean; twilioAccountSid: string | null; twilioAuthToken: string | null; twilioFromNumber: string | null }) {
  if (!channel.isActive) {
    throw new Error("This channel has been disconnected");
  }
  // Voice calls are part of the paid service — same subscription gate as messages.
  await requireActiveSubscription(reminder.orgId);
  if (!channel.twilioAccountSid || !channel.twilioAuthToken || !channel.twilioFromNumber || !contact.phone) {
    throw new Error("Voice channel not configured for this contact");
  }

  const callLog = await prisma.callLog.create({
    data: {
      orgId: reminder.orgId,
      contactId: reminder.contactId,
      channelId: reminder.channelId,
      reminderId: reminder.id,
      message: reminder.message,
    },
  });

  const secret = channelWebhookSecret(callLog.id);
  const base = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    const call = await twilioPlaceCall({
      accountSid: channel.twilioAccountSid,
      authToken: decryptSecret(channel.twilioAuthToken),
      from: channel.twilioFromNumber,
      to: contact.phone,
      twimlUrl: `${base}/api/voice/twiml/${callLog.id}?secret=${secret}`,
      statusCallbackUrl: `${base}/api/voice/status/${callLog.id}?secret=${secret}`,
    });
    await prisma.callLog.update({ where: { id: callLog.id }, data: { twilioCallSid: call.sid } });
  } catch (err) {
    await prisma.callLog.update({ where: { id: callLog.id }, data: { status: "FAILED" } });
    throw err;
  }
}

async function processReminderJob(job: Job<ReminderSendJob>) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: job.data.reminderId },
    include: { contact: true, channel: true, whatsappTemplate: true },
  });
  if (!reminder || reminder.status !== "PENDING") return; // cancelled or already handled

  try {
    if (reminder.channel.type === "VOICE") {
      await placeReminderCall(reminder, reminder.contact, reminder.channel);
    } else if (reminder.whatsappTemplate) {
      if (!reminder.whatsappTemplate.gupshupTemplateId) {
        throw new Error("Template was never confirmed by Gupshup — check its status in Settings");
      }
      await sendViaChannel(
        reminder.channel,
        reminder.contact,
        reminder.message,
        undefined,
        {
          gupshupTemplateId: reminder.whatsappTemplate.gupshupTemplateId,
          params: [reminder.contact.name?.trim() || "there"],
          category: reminder.whatsappTemplate.category,
        },
        { type: "REMINDER", id: reminder.id }
      );
    } else {
      await sendViaChannel(reminder.channel, reminder.contact, reminder.message, undefined, undefined, {
        type: "REMINDER",
        id: reminder.id,
      });
    }
  } catch (err) {
    const message =
      err instanceof InsufficientWalletBalanceError
        ? "Insufficient WhatsApp balance — top up the wallet from Billing"
        : err instanceof Error
          ? err.message
          : "Send failed";
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: "FAILED", error: message },
    });
    console.error(`Reminder ${reminder.id} failed:`, err);
    return;
  }

  // The send succeeded — mark SENT unconditionally now. Scheduling the next
  // recurrence is a separate concern below and must never be able to
  // retroactively overwrite this already-successful send's status.
  await prisma.reminder.update({ where: { id: reminder.id }, data: { status: "SENT", error: null } });

  const next = nextOccurrence(reminder.scheduledFor, reminder.recurrence);
  if (next) {
    try {
      const nextReminder = await prisma.reminder.create({
        data: {
          orgId: reminder.orgId,
          contactId: reminder.contactId,
          channelId: reminder.channelId,
          message: reminder.message,
          whatsappTemplateId: reminder.whatsappTemplateId,
          scheduledFor: next,
          recurrence: reminder.recurrence,
        },
      });
      await enqueueReminder(nextReminder.id, next);
    } catch (err) {
      console.error(`Failed to schedule next occurrence of reminder ${reminder.id}:`, err);
    }
  }
}

const campaignWorker = new Worker<CampaignSendJob>(CAMPAIGN_SEND_QUEUE, processCampaignJob, {
  connection: redisConnection,
  concurrency: CAMPAIGN_WORKER_CONCURRENCY,
  limiter: { max: CAMPAIGN_RATE_PER_SECOND, duration: 1000 },
});

const reminderWorker = new Worker<ReminderSendJob>(REMINDER_SEND_QUEUE, processReminderJob, {
  connection: redisConnection,
  concurrency: REMINDER_WORKER_CONCURRENCY,
});

campaignWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: CAMPAIGN_SEND_QUEUE }, extra: { jobId: job?.id } });
  console.error(`Campaign job ${job?.id} failed:`, err);
});
reminderWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: REMINDER_SEND_QUEUE }, extra: { jobId: job?.id } });
  console.error(`Reminder job ${job?.id} failed:`, err);
});

console.log("Evernaro worker running — listening for campaign-send and reminder-send jobs.");
