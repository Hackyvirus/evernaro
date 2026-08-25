import { prisma } from "@/lib/prisma";
import { QueueEntryStatus, type Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { startOfDayInTimezone } from "@/lib/timezone";
import { generateReviewToken } from "@/lib/services/review-requests";

export function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}
import { enqueueNoShow, cancelNoShowJob } from "@/lib/queue";
import { sendQueueNotification, sendBusinessQueueNotification } from "@/lib/customer-notifications";

const OTP_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SERVICE_MINUTES = 5;

export class QueueDuplicateJoinError extends Error {
  constructor() {
    super("Contact already has an active entry in this queue");
    this.name = "QueueDuplicateJoinError";
  }
}

export async function getQueuesByOrg(orgId: string, locationId?: string | null) {
  return prisma.queue.findMany({
    where: { orgId, isActive: true, ...(locationId ? { locationId } : {}) },
    include: {
      service: true,
      entries: {
        where: { status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED, QueueEntryStatus.IN_PROGRESS] } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { contact: true, service: true, staff: true },
      },
    },
  });
}

export async function getQueueById(id: string, orgId: string) {
  return prisma.queue.findFirst({
    where: { id, orgId },
    include: {
      service: true,
      entries: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { contact: true, service: true, staff: true },
      },
    },
  });
}

export async function createQueue(orgId: string, data: { name: string; serviceId?: string; locationId?: string | null }) {
  return prisma.queue.create({
    data: {
      orgId,
      locationId: data.locationId,
      name: data.name,
      serviceId: data.serviceId,
    },
    include: { service: true },
  });
}

export async function getNextPosition(queueId: string) {
  // Must consider every entry created today in this queue, not just entries
  // still WAITING. Filtering to WAITING meant that as soon as the queue's
  // only entry was called (leaving zero WAITING rows), the "last position"
  // lookup found nothing and restarted from 0 -- so every subsequent join
  // got position 1 and display token "G-1" again, duplicating both across
  // the queue's whole history instead of ever incrementing past the number
  // of people simultaneously waiting. The "ahead of me" count elsewhere
  // still filters to WAITING + a smaller position, so it's unaffected by
  // position values no longer resetting within a day.
  //
  // Scoped to the business's own calendar day (its org timezone, not UTC
  // midnight) so tokens reset to G-1 each morning like a real walk-in queue,
  // rather than climbing indefinitely across the queue's whole lifetime.
  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    select: { org: { select: { timezone: true } } },
  });
  const todayStart = startOfDayInTimezone(queue?.org.timezone ?? "Asia/Kolkata");

  const last = await prisma.queueEntry.findFirst({
    where: { queueId, createdAt: { gte: todayStart } },
    orderBy: { position: "desc" },
  });
  return (last?.position ?? 0) + 1;
}

export function generatePublicToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function computeEstimatedWaitMin(queueId: string, position: number): Promise<number> {
  const entries = await prisma.queueEntry.findMany({
    where: { queueId, status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED, QueueEntryStatus.IN_PROGRESS] } },
    include: { service: { select: { durationMin: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const ahead = entries.filter((e) => e.position < position);
  if (ahead.length === 0) return 0;

  const total = ahead.reduce((sum, e) => sum + (e.service?.durationMin ?? DEFAULT_SERVICE_MINUTES), 0);
  return Math.max(0, total);
}

export async function joinQueue(data: {
  orgId: string;
  queueId: string;
  contactId: string;
  serviceId?: string;
  staffId?: string;
  token?: string;
  isAfterHours?: boolean;
}) {
  const existing = await prisma.queueEntry.findFirst({
    where: {
      queueId: data.queueId,
      contactId: data.contactId,
      status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED] },
    },
  });
  if (existing) {
    throw new QueueDuplicateJoinError();
  }

  const position = await getNextPosition(data.queueId);
  const token = data.token ?? (await generateDisplayToken(data.queueId, position));
  const publicToken = generatePublicToken();
  const verificationCode = generateVerificationCode();
  const verificationCodeExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  const estimatedWaitMin = await computeEstimatedWaitMin(data.queueId, position);

  const entry = await prisma.queueEntry.create({
    data: {
      orgId: data.orgId,
      queueId: data.queueId,
      contactId: data.contactId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      token,
      publicToken,
      verificationCode,
      verificationCodeExpiresAt,
      position,
      estimatedWaitMin,
      status: QueueEntryStatus.WAITING,
      isAfterHours: data.isAfterHours ?? false,
    },
    include: { contact: true, service: true, staff: true, queue: true },
  });

  const org = await prisma.organization.findUnique({
    where: { id: data.orgId },
    select: { name: true },
  });

  void sendQueueNotification(data.orgId, entry.contact, "joined", {
    token: entry.token,
    position: entry.position,
    estimatedWaitMin: entry.estimatedWaitMin ?? 0,
    queueName: entry.queue.name,
    businessName: org?.name ?? "",
    serviceName: entry.service?.name,
    staffName: entry.staff?.name,
  });

  void sendBusinessQueueNotification(
    data.orgId,
    { token: entry.token, contact: entry.contact, queue: entry.queue },
    org?.name ?? "",
    entry.isAfterHours
  );

  return entry;
}

async function generateDisplayToken(queueId: string, position: number) {
  const queue = await prisma.queue.findUnique({ where: { id: queueId }, select: { name: true } });
  const prefix = queue?.name?.[0]?.toUpperCase() ?? "Q";
  return `${prefix}-${position}`;
}

export class QueueInvalidTransitionError extends Error {
  constructor() {
    super("Invalid queue entry status transition");
    this.name = "QueueInvalidTransitionError";
  }
}

const VALID_QUEUE_TRANSITIONS: Record<QueueEntryStatus, QueueEntryStatus[]> = {
  [QueueEntryStatus.WAITING]: [QueueEntryStatus.CALLED, QueueEntryStatus.CANCELLED],
  [QueueEntryStatus.CALLED]: [QueueEntryStatus.IN_PROGRESS, QueueEntryStatus.NO_SHOW, QueueEntryStatus.CANCELLED],
  [QueueEntryStatus.IN_PROGRESS]: [QueueEntryStatus.COMPLETED, QueueEntryStatus.CANCELLED],
  [QueueEntryStatus.COMPLETED]: [],
  [QueueEntryStatus.CANCELLED]: [],
  [QueueEntryStatus.NO_SHOW]: [],
};

export async function updateQueueEntryStatus(
  id: string,
  orgId: string,
  status: QueueEntryStatus,
  extra?: { staffId?: string }
) {
  const entry = await prisma.queueEntry.findFirst({
    where: { id, orgId },
    select: { status: true },
  });
  if (!entry) return { count: 0 };
  if (!VALID_QUEUE_TRANSITIONS[entry.status].includes(status)) {
    throw new QueueInvalidTransitionError();
  }

  const data: Prisma.QueueEntryUncheckedUpdateManyInput = { status };
  if (status === QueueEntryStatus.CALLED) {
    data.calledAt = new Date();
    // The code's 5-minute window must start when the customer is actually
    // called, not when they joined -- the old code set it once at join time
    // and never refreshed it, so anyone who waited more than 5 minutes in
    // line (the normal case) had an already-dead code before staff ever
    // called them.
    data.verificationCode = generateVerificationCode();
    data.verificationCodeExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  }
  if (status === QueueEntryStatus.IN_PROGRESS) data.startedAt = new Date();
  if (status === QueueEntryStatus.COMPLETED) data.completedAt = new Date();
  if (status === QueueEntryStatus.CANCELLED) data.cancelledAt = new Date();
  if (status === QueueEntryStatus.NO_SHOW) data.noShowAt = new Date();
  if (extra?.staffId) data.staffId = extra.staffId;

  const result = await prisma.queueEntry.updateMany({
    where: { id, orgId },
    data,
  });

  // CALLED was missing from this list entirely -- the dashboard's per-row
  // "Call" button (PATCH /api/queue/entries/[id]/status, what the UI
  // actually uses) generated and displayed a fresh verification code
  // correctly, but never sent it anywhere. Only callNextInQueue (a
  // different, separate function) sent the "called" WhatsApp notification;
  // the button wired to the actual UI never called it. Confirmed live: the
  // wallet was never charged for a "called" transition through this path,
  // meaning no send was ever attempted -- the customer could only ever see
  // the code by having the tracker page open at the right moment, not via
  // the WhatsApp push this was supposed to provide.
  if (
    result.count > 0 &&
    (status === QueueEntryStatus.COMPLETED ||
      status === QueueEntryStatus.CANCELLED ||
      status === QueueEntryStatus.CALLED)
  ) {
    const entry = await prisma.queueEntry.findFirst({
      where: { id, orgId },
      include: { contact: true, service: true, staff: true, queue: true },
    });
    if (entry?.contact) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      const event =
        status === QueueEntryStatus.COMPLETED
          ? "completed"
          : status === QueueEntryStatus.CANCELLED
            ? "cancelled"
            : "called";
      void sendQueueNotification(orgId, entry.contact, event, {
        token: entry.token,
        position: entry.position,
        estimatedWaitMin: entry.estimatedWaitMin ?? 0,
        queueName: entry.queue.name,
        businessName: org?.name ?? "",
        serviceName: entry.service?.name,
        staffName: entry.staff?.name,
        verificationCode: entry.verificationCode,
      });
    }
  }

  return result;
}

export async function callNextInQueue(queueId: string, orgId: string, staffId?: string) {
  const entry = await prisma.$transaction(async (tx) => {
    // Lock the next waiting entry so concurrent callers receive different rows.
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "QueueEntry" WHERE "queueId" = $1 AND "orgId" = $2 AND "status" = $3 ORDER BY "position" ASC, "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      queueId,
      orgId,
      QueueEntryStatus.WAITING
    );
    if (!rows.length) return null;

    const nextId = rows[0].id;
    await tx.queueEntry.update({
      where: { id: nextId },
      data: {
        status: QueueEntryStatus.CALLED,
        calledAt: new Date(),
        // Same reasoning as updateQueueEntryStatus: refresh the code and its
        // 5-minute window at call time, not join time.
        verificationCode: generateVerificationCode(),
        verificationCodeExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        ...(staffId ? { staffId } : {}),
      },
    });

    return tx.queueEntry.findUnique({
      where: { id: nextId },
      include: { queue: true, contact: true, service: true, staff: true },
    });
  });

  if (!entry) return null;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  if (entry.contact) {
    void sendQueueNotification(orgId, entry.contact, "called", {
      token: entry.token,
      position: entry.position,
      estimatedWaitMin: entry.estimatedWaitMin ?? 0,
      queueName: entry.queue.name,
      businessName: org?.name ?? "",
      serviceName: entry.service?.name,
      staffName: entry.staff?.name,
      verificationCode: entry.verificationCode,
    });
  }

  await scheduleNoShowCheck(entry.id, orgId, entry.queue.noShowThresholdSeconds);

  // Re-normalize positions for remaining waiting entries
  await normalizeQueuePositions(queueId);

  return prisma.queueEntry.findUnique({
    where: { id: entry.id },
    include: { contact: true, service: true, staff: true },
  });
}

export async function normalizeQueuePositions(queueId: string) {
  const waiting = await prisma.queueEntry.findMany({
    where: { queueId, status: QueueEntryStatus.WAITING },
    orderBy: [{ createdAt: "asc" }],
  });

  for (let i = 0; i < waiting.length; i++) {
    await prisma.queueEntry.update({
      where: { id: waiting[i].id },
      data: { position: i + 1 },
    });
  }
}

export async function getQueueEntryByToken(token: string, orgId: string) {
  return prisma.queueEntry.findFirst({
    where: { token, orgId },
    include: { contact: true, service: true, staff: true, queue: true },
  });
}

export async function getQueueEntryByPublicToken(publicToken: string) {
  return prisma.queueEntry.findUnique({
    where: { publicToken },
    include: {
      contact: true,
      service: true,
      staff: true,
      queue: { include: { org: { select: { name: true, slug: true } } } },
    },
  });
}

export async function getPublicQueueStatus(publicToken: string) {
  const entry = await getQueueEntryByPublicToken(publicToken);
  if (!entry) return null;

  const ahead = await prisma.queueEntry.count({
    where: {
      queueId: entry.queueId,
      status: QueueEntryStatus.WAITING,
      position: { lt: entry.position },
    },
  });

  // Generated on the fly rather than stored -- the customer is already on
  // this page when their entry completes, so there's no need for the
  // scheduled-reminder flow appointments use. Only issued once there's a
  // completed visit and a contact to attribute the review to.
  const reviewUrl =
    entry.status === QueueEntryStatus.COMPLETED && entry.contactId
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/business/${entry.queue.org.slug}/review?t=${
          generateReviewToken(entry.contactId, { type: "queueEntry", id: entry.id }).token
        }`
      : null;

  return {
    token: entry.token,
    publicToken: entry.publicToken,
    status: entry.status,
    isAfterHours: entry.isAfterHours,
    position: entry.position,
    ahead,
    estimatedWaitMin: entry.estimatedWaitMin ?? 0,
    queue: { name: entry.queue.name },
    businessName: entry.queue.org.name,
    service: entry.service
      ? { name: entry.service.name, durationMin: entry.service.durationMin }
      : null,
    // Only surfaced while there's an active code to show — null once the
    // entry is verified or never had one. The tracker page was telling
    // customers "your verification code is required" without ever showing
    // it anywhere, and staff had no legitimate way to obtain it either.
    verificationCode: entry.verificationCode,
    calledAt: entry.calledAt,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    cancelledAt: entry.cancelledAt,
    noShowAt: entry.noShowAt,
    createdAt: entry.createdAt,
    reviewUrl,
  };
}

export async function verifyQueueEntry(publicToken: string, code: string, orgId: string) {
  const entry = await prisma.queueEntry.findFirst({
    where: { publicToken, orgId },
    include: { queue: true },
  });

  if (!entry) return { ok: false, error: "Entry not found" as const };
  if (!entry.verificationCode) return { ok: false, error: "Already verified" as const };
  if (entry.verificationCode !== code) return { ok: false, error: "Invalid code" as const };
  if (entry.verificationCodeExpiresAt && entry.verificationCodeExpiresAt < new Date()) {
    return { ok: false, error: "Code expired" as const };
  }

  await prisma.$transaction([
    prisma.queueEntry.update({
      where: { id: entry.id },
      data: {
        verificationCode: null,
        verificationCodeExpiresAt: null,
        status: QueueEntryStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    }),
  ]);
  await cancelNoShowJob(entry.id);

  return { ok: true, entry: await getQueueEntryByPublicToken(publicToken) };
}

export async function cancelQueueEntryByPublicToken(publicToken: string, verificationCode?: string, phone?: string) {
  const entry = await getQueueEntryByPublicToken(publicToken);
  if (!entry) return null;
  if (entry.status === QueueEntryStatus.COMPLETED || entry.status === QueueEntryStatus.NO_SHOW) {
    return {
      token: entry.token,
      publicToken: entry.publicToken,
      status: entry.status,
    };
  }

  // Public token alone is not enough to cancel. Require either the phone
  // number the customer joined with, or the original verification code.
  if (phone) {
    if (!entry.contact?.phone || entry.contact.phone.replace(/\D/g, "") !== phone.replace(/\D/g, "")) {
      return { error: "Phone number does not match this queue entry" as const };
    }
  } else if (entry.verificationCode) {
    if (!verificationCode) {
      return { error: "Verification code is required" as const };
    }
    if (entry.verificationCode !== verificationCode) {
      return { error: "Invalid verification code" as const };
    }
    if (entry.verificationCodeExpiresAt && entry.verificationCodeExpiresAt < new Date()) {
      return { error: "Verification code has expired" as const };
    }
  } else {
    return { error: "Verification is required to cancel" as const };
  }

  const updated = await prisma.queueEntry.update({
    where: { id: entry.id },
    data: { status: QueueEntryStatus.CANCELLED, cancelledAt: new Date() },
  });
  await cancelNoShowJob(entry.id);
  await normalizeQueuePositions(entry.queueId);

  if (entry.contact) {
    const org = await prisma.organization.findUnique({
      where: { id: entry.orgId },
      select: { name: true },
    });
    void sendQueueNotification(entry.orgId, entry.contact, "cancelled", {
      token: entry.token,
      position: entry.position,
      estimatedWaitMin: entry.estimatedWaitMin ?? 0,
      queueName: entry.queue.name,
      businessName: org?.name ?? "",
      serviceName: entry.service?.name,
      staffName: entry.staff?.name,
    });
  }

  return {
    token: updated.token,
    publicToken: updated.publicToken,
    status: updated.status,
  };
}

export async function scheduleNoShowCheck(queueEntryId: string, orgId: string, thresholdSeconds: number) {
  const { jobId } = await enqueueNoShow(queueEntryId, orgId, thresholdSeconds * 1000);
  await prisma.queueEntry.update({
    where: { id: queueEntryId },
    data: { autoNoShowJobId: jobId },
  });
}

export async function markNoShow(queueEntryId: string, orgId: string) {
  const entry = await prisma.queueEntry.findFirst({ where: { id: queueEntryId, orgId } });
  if (!entry) return null;
  if (entry.status === QueueEntryStatus.IN_PROGRESS || entry.status === QueueEntryStatus.COMPLETED) {
    return entry;
  }

  const updated = await prisma.queueEntry.update({
    where: { id: entry.id },
    data: { status: QueueEntryStatus.NO_SHOW, noShowAt: new Date() },
  });
  await normalizeQueuePositions(entry.queueId);
  return updated;
}
