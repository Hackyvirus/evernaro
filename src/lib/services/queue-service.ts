import { prisma } from "@/lib/prisma";
import { QueueEntryStatus, type Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { enqueueNoShow, cancelNoShowJob } from "@/lib/queue";

const OTP_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SERVICE_MINUTES = 5;

export async function getQueuesByOrg(orgId: string) {
  return prisma.queue.findMany({
    where: { orgId, isActive: true },
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

export async function createQueue(orgId: string, data: { name: string; serviceId?: string }) {
  return prisma.queue.create({
    data: {
      orgId,
      name: data.name,
      serviceId: data.serviceId,
    },
    include: { service: true },
  });
}

export async function getNextPosition(queueId: string) {
  const last = await prisma.queueEntry.findFirst({
    where: { queueId, status: QueueEntryStatus.WAITING },
    orderBy: { position: "desc" },
  });
  return (last?.position ?? 0) + 1;
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
}) {
  const position = await getNextPosition(data.queueId);
  const token = data.token ?? (await generateDisplayToken(data.queueId, position));
  const publicToken = generatePublicToken();
  const verificationCode = generateVerificationCode();
  const verificationCodeExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  const estimatedWaitMin = await computeEstimatedWaitMin(data.queueId, position);

  return prisma.queueEntry.create({
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
    },
    include: { contact: true, service: true, staff: true, queue: true },
  });
}

async function generateDisplayToken(queueId: string, position: number) {
  const queue = await prisma.queue.findUnique({ where: { id: queueId }, select: { name: true } });
  const prefix = queue?.name?.[0]?.toUpperCase() ?? "Q";
  return `${prefix}-${position}`;
}

export async function updateQueueEntryStatus(
  id: string,
  orgId: string,
  status: QueueEntryStatus,
  extra?: { staffId?: string }
) {
  const data: Prisma.QueueEntryUncheckedUpdateManyInput = { status };
  if (status === QueueEntryStatus.CALLED) data.calledAt = new Date();
  if (status === QueueEntryStatus.IN_PROGRESS) data.startedAt = new Date();
  if (status === QueueEntryStatus.COMPLETED) data.completedAt = new Date();
  if (status === QueueEntryStatus.CANCELLED) data.cancelledAt = new Date();
  if (status === QueueEntryStatus.NO_SHOW) data.noShowAt = new Date();
  if (extra?.staffId) data.staffId = extra.staffId;

  return prisma.queueEntry.updateMany({
    where: { id, orgId },
    data,
  });
}

export async function callNextInQueue(queueId: string, orgId: string, staffId?: string) {
  const next = await prisma.queueEntry.findFirst({
    where: {
      queueId,
      orgId,
      status: QueueEntryStatus.WAITING,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { queue: true },
  });

  if (!next) return null;

  await updateQueueEntryStatus(next.id, orgId, QueueEntryStatus.CALLED, { staffId });
  await scheduleNoShowCheck(next.id, orgId, next.queue.noShowThresholdSeconds);

  // Re-normalize positions for remaining waiting entries
  await normalizeQueuePositions(queueId);

  return prisma.queueEntry.findUnique({
    where: { id: next.id },
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
    include: { contact: true, service: true, staff: true, queue: true },
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

  return {
    id: entry.id,
    token: entry.token,
    publicToken: entry.publicToken,
    status: entry.status,
    position: entry.position,
    ahead,
    estimatedWaitMin: entry.estimatedWaitMin,
    queue: { id: entry.queue.id, name: entry.queue.name },
    contact: entry.contact,
    service: entry.service,
    staff: entry.staff,
    calledAt: entry.calledAt,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    cancelledAt: entry.cancelledAt,
    noShowAt: entry.noShowAt,
    createdAt: entry.createdAt,
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

export async function cancelQueueEntryByPublicToken(publicToken: string) {
  const entry = await getQueueEntryByPublicToken(publicToken);
  if (!entry) return null;
  if (entry.status === QueueEntryStatus.COMPLETED || entry.status === QueueEntryStatus.NO_SHOW) {
    return entry;
  }

  const updated = await prisma.queueEntry.update({
    where: { id: entry.id },
    data: { status: QueueEntryStatus.CANCELLED, cancelledAt: new Date() },
  });
  await cancelNoShowJob(entry.id);
  await normalizeQueuePositions(entry.queueId);
  return updated;
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
