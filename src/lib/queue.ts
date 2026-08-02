import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const CAMPAIGN_SEND_QUEUE = "campaign-send";
export const REMINDER_SEND_QUEUE = "reminder-send";

const globalForQueues = globalThis as unknown as {
  campaignQueue: Queue | undefined;
  reminderQueue: Queue | undefined;
};

export const campaignQueue =
  globalForQueues.campaignQueue ??
  new Queue(CAMPAIGN_SEND_QUEUE, { connection: redisConnection });

export const reminderQueue =
  globalForQueues.reminderQueue ??
  new Queue(REMINDER_SEND_QUEUE, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.campaignQueue = campaignQueue;
  globalForQueues.reminderQueue = reminderQueue;
}

export interface CampaignSendJob {
  campaignRecipientId: string;
}

export interface ReminderSendJob {
  reminderId: string;
}

export async function enqueueCampaignRecipient(campaignRecipientId: string) {
  // One attempt: on failure the recipient is marked FAILED immediately
  // (visible in the campaign's stats) rather than silently retried.
  await campaignQueue.add(
    "send",
    { campaignRecipientId } satisfies CampaignSendJob,
    { jobId: campaignRecipientId }
  );
}

export async function enqueueReminder(reminderId: string, scheduledFor: Date) {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  await reminderQueue.add(
    "send",
    { reminderId } satisfies ReminderSendJob,
    { jobId: reminderId, delay }
  );
}

// Returns { removed: false } if the job had already been picked up by a
// worker (BullMQ throws when trying to remove an active/locked job) — the
// caller still marks the reminder CANCELLED in the DB either way, but should
// warn the user the in-flight send may complete anyway.
export async function cancelReminderJob(reminderId: string): Promise<{ removed: boolean }> {
  const job = await reminderQueue.getJob(reminderId);
  if (!job) return { removed: true };
  try {
    await job.remove();
    return { removed: true };
  } catch {
    return { removed: false };
  }
}
