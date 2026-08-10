// Standalone worker process — run with `npm run worker`.
// Next.js API routes are request/response only; bulk sends and scheduled
// reminders need a long-lived process to consume BullMQ jobs, so this file
// is that process. Deploy it separately from the web app (e.g. a small
// background worker service) alongside the web app in production.

import * as Sentry from "@sentry/node";
import { Queue, Worker, type Job } from "bullmq";
import { RecipientStatus, ReminderStatus } from "@prisma/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  NO_SHOW_QUEUE,
  BILLING_RUN_QUEUE,
  enqueueReminder,
  type CampaignSendJob,
  type ReminderSendJob,
  type NoShowJob,
  type BillingRunJob,
} from "../lib/queue";
import { markNoShow } from "../lib/services/queue-service";
import { runDailyBilling, runDunningReminders } from "../lib/billing/billing-run";

// This process runs outside Next.js (`npm run worker`), so it isn't covered
// by src/instrumentation.ts — needs its own Sentry init. No-op until
// SENTRY_DSN is set.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
}

process.on("uncaughtException", async (err) => {
  Sentry.captureException(err);
  console.error("Uncaught exception in worker:", err);
  try {
    await Sentry.flush(2000);
  } catch {}
  process.exit(1);
});
process.on("unhandledRejection", async (err) => {
  Sentry.captureException(err);
  console.error("Unhandled rejection in worker:", err);
  try {
    await Sentry.flush(2000);
  } catch {}
  process.exit(1);
});

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
let isShuttingDown = false;

const healthFile = process.env.WORKER_HEALTH_FILE || path.join(os.tmpdir(), "worker.health");
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
    await Promise.all([campaignWorker.close(), reminderWorker.close(), noShowWorker.close(), billingRunWorker.close()]);
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
const NO_SHOW_WORKER_CONCURRENCY = Number(process.env.NO_SHOW_WORKER_CONCURRENCY || 20);

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

  // Lock the recipient into SENDING before calling the provider. If anything
  // crashes after this point, retries will see SENDING (not PENDING) and skip
  // a duplicate send. The final transaction below resolves it to SENT/FAILED.
  const locked = await prisma.campaignRecipient.updateMany({
    where: { id: recipient.id, status: "PENDING" },
    data: { status: "SENDING" },
  });
  if (locked.count === 0) return;

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
      where: { campaignId: recipient.campaignId, status: { notIn: [RecipientStatus.SENT, RecipientStatus.FAILED] } },
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
}, contact: { name: string | null; phone: string | null }, channel: { isActive: boolean; twilioAccountSid: string | null; twilioAuthToken: string | null; twilioFromNumber: string | null }) {
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
      message: renderTemplate(reminder.message, contact.name),
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
  const MAX_REMINDER_RECURRENCE_YEARS = 2;
  const maxFutureDate = reminder
    ? new Date(reminder.createdAt.getTime() + MAX_REMINDER_RECURRENCE_YEARS * 365 * 24 * 60 * 60 * 1000)
    : null;
  if (!reminder || reminder.status !== "PENDING") return; // cancelled or already handled

  const text = renderTemplate(reminder.message, reminder.contact.name);

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
        text,
        undefined,
        {
          gupshupTemplateId: reminder.whatsappTemplate.gupshupTemplateId,
          params: [reminder.contact.name?.trim() || "there"],
          category: reminder.whatsappTemplate.category,
        },
        { type: "REMINDER", id: reminder.id }
      );
    } else {
      await sendViaChannel(reminder.channel, reminder.contact, text, undefined, undefined, {
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
  if (next && maxFutureDate && next.getTime() <= maxFutureDate.getTime()) {
    try {
      // Idempotency: a retried job must not create duplicate future occurrences.
      const existingNext = await prisma.reminder.findFirst({
        where: {
          orgId: reminder.orgId,
          contactId: reminder.contactId,
          channelId: reminder.channelId,
          message: reminder.message,
          scheduledFor: next,
          status: ReminderStatus.PENDING,
        },
      });
      if (existingNext) return;

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

async function processNoShowJob(job: Job<NoShowJob>) {
  const { queueEntryId, orgId } = job.data;
  const entry = await prisma.queueEntry.findFirst({ where: { id: queueEntryId, orgId } });
  if (!entry) return;
  if (entry.status !== "CALLED") return; // already served or no-showed manually
  await markNoShow(queueEntryId, orgId);
}

async function processBillingJob(job: Job<BillingRunJob>) {
  if (job.data.type === "daily") {
    await runDailyBilling();
  } else if (job.data.type === "dunning") {
    await runDunningReminders();
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

const noShowWorker = new Worker<NoShowJob>(NO_SHOW_QUEUE, processNoShowJob, {
  connection: redisConnection,
  concurrency: NO_SHOW_WORKER_CONCURRENCY,
});

const billingRunWorker = new Worker<BillingRunJob>(BILLING_RUN_QUEUE, processBillingJob, {
  connection: redisConnection,
  concurrency: 1,
});

// Schedule the daily billing run (invoices + dunning) at 00:05 UTC.
const billingRunQueue = new Queue(BILLING_RUN_QUEUE, { connection: redisConnection });
billingRunQueue.upsertJobScheduler(
  "daily-billing",
  { pattern: "5 0 * * *" },
  { name: "daily", data: { type: "daily" } satisfies BillingRunJob }
);
billingRunQueue.upsertJobScheduler(
  "dunning-check",
  { pattern: "0 */6 * * *" },
  { name: "dunning", data: { type: "dunning" } satisfies BillingRunJob }
);

campaignWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: CAMPAIGN_SEND_QUEUE }, extra: { jobId: job?.id } });
  console.error(`Campaign job ${job?.id} failed:`, err);
});
reminderWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: REMINDER_SEND_QUEUE }, extra: { jobId: job?.id } });
  console.error(`Reminder job ${job?.id} failed:`, err);
});
noShowWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: NO_SHOW_QUEUE }, extra: { jobId: job?.id } });
  console.error(`No-show job ${job?.id} failed:`, err);
});
billingRunWorker.on("failed", (job, err) => {
  Sentry.captureException(err, { tags: { queue: BILLING_RUN_QUEUE }, extra: { jobId: job?.id } });
  console.error(`Billing run job ${job?.id} failed:`, err);
});

console.log("Evernaro worker running — listening for campaign-send, reminder-send, queue-no-show, and billing-run jobs.");
