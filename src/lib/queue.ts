import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const CAMPAIGN_SEND_QUEUE = "campaign-send";
export const REMINDER_SEND_QUEUE = "reminder-send";
export const NO_SHOW_QUEUE = "queue-no-show";
export const BILLING_RUN_QUEUE = "billing-run";

const globalForQueues = globalThis as unknown as {
  campaignQueue: Queue | undefined;
  reminderQueue: Queue | undefined;
  noShowQueue: Queue | undefined;
  billingRunQueue: Queue | undefined;
};

function getCampaignQueue(): Queue {
  if (!globalForQueues.campaignQueue) {
    globalForQueues.campaignQueue = new Queue(CAMPAIGN_SEND_QUEUE, { connection: redisConnection });
  }
  return globalForQueues.campaignQueue;
}

function getReminderQueue(): Queue {
  if (!globalForQueues.reminderQueue) {
    globalForQueues.reminderQueue = new Queue(REMINDER_SEND_QUEUE, { connection: redisConnection });
  }
  return globalForQueues.reminderQueue;
}

function getNoShowQueue(): Queue {
  if (!globalForQueues.noShowQueue) {
    globalForQueues.noShowQueue = new Queue(NO_SHOW_QUEUE, { connection: redisConnection });
  }
  return globalForQueues.noShowQueue;
}

function getBillingRunQueue(): Queue {
  if (!globalForQueues.billingRunQueue) {
    globalForQueues.billingRunQueue = new Queue(BILLING_RUN_QUEUE, { connection: redisConnection });
  }
  return globalForQueues.billingRunQueue;
}

export interface CampaignSendJob {
  campaignRecipientId: string;
}

export interface ReminderSendJob {
  reminderId: string;
}

export interface NoShowJob {
  queueEntryId: string;
  orgId: string;
}

export interface BillingRunJob {
  type: "daily" | "dunning";
}

export async function enqueueCampaignRecipient(campaignRecipientId: string, delayMs?: number) {
  // One attempt: on failure the recipient is marked FAILED immediately
  // (visible in the campaign's stats) rather than silently retried.
  await getCampaignQueue().add(
    "send",
    { campaignRecipientId } satisfies CampaignSendJob,
    {
      jobId: campaignRecipientId,
      delay: delayMs && delayMs > 0 ? delayMs : undefined,
      attempts: 1,
      removeOnFail: true,
      removeOnComplete: true,
    }
  );
}

export async function enqueueReminder(reminderId: string, scheduledFor: Date) {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  await getReminderQueue().add(
    "send",
    { reminderId } satisfies ReminderSendJob,
    { jobId: reminderId, delay, attempts: 1, removeOnFail: true, removeOnComplete: true }
  );
}

// Returns { removed: false } if the job had already been picked up by a
// worker (BullMQ throws when trying to remove an active/locked job) — the
// caller still marks the reminder CANCELLED in the DB either way, but should
// warn the user the in-flight send may complete anyway.
export async function cancelReminderJob(reminderId: string): Promise<{ removed: boolean }> {
  const job = await getReminderQueue().getJob(reminderId);
  if (!job) return { removed: true };
  try {
    await job.remove();
    return { removed: true };
  } catch {
    return { removed: false };
  }
}

export async function cancelCampaignRecipientJob(recipientId: string): Promise<{ removed: boolean }> {
  const job = await getCampaignQueue().getJob(recipientId);
  if (!job) return { removed: true };
  try {
    await job.remove();
    return { removed: true };
  } catch {
    return { removed: false };
  }
}

export async function enqueueNoShow(
  queueEntryId: string,
  orgId: string,
  delayMs: number
): Promise<{ jobId: string }> {
  const jobId = `no-show:${queueEntryId}`;
  await getNoShowQueue().add(
    "check",
    { queueEntryId, orgId } satisfies NoShowJob,
    {
      jobId,
      delay: Math.max(0, delayMs),
      attempts: 2,
      backoff: { type: "fixed", delay: 60_000 },
      removeOnFail: { count: 100 },
      removeOnComplete: { count: 100 },
    }
  );
  return { jobId };
}

export async function cancelNoShowJob(queueEntryId: string): Promise<{ removed: boolean }> {
  const job = await getNoShowQueue().getJob(`no-show:${queueEntryId}`);
  if (!job) return { removed: true };
  try {
    await job.remove();
    return { removed: true };
  } catch {
    return { removed: false };
  }
}

export async function enqueueBillingRun(job: BillingRunJob, delayMs?: number) {
  await getBillingRunQueue().add(job.type, job, {
    jobId: `${job.type}:${Date.now()}`,
    delay: delayMs && delayMs > 0 ? delayMs : undefined,
    attempts: 2,
    backoff: { type: "fixed", delay: 60_000 },
    removeOnFail: { count: 50 },
    removeOnComplete: { count: 10 },
  });
}
