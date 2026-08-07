import { prisma } from "@/lib/prisma";
import { QueueEntryStatus, type Prisma } from "@prisma/client";

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

export async function joinQueue(data: {
  orgId: string;
  queueId: string;
  contactId: string;
  serviceId?: string;
  staffId?: string;
  token?: string;
}) {
  const position = await getNextPosition(data.queueId);
  const token = data.token ?? (await generateToken(data.queueId, position));

  return prisma.queueEntry.create({
    data: {
      orgId: data.orgId,
      queueId: data.queueId,
      contactId: data.contactId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      token,
      position,
      status: QueueEntryStatus.WAITING,
    },
    include: { contact: true, service: true, staff: true },
  });
}

async function generateToken(queueId: string, position: number) {
  // First letter of queue name + position, e.g. "A-12"
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
  });

  if (!next) return null;

  await updateQueueEntryStatus(next.id, orgId, QueueEntryStatus.CALLED, { staffId });

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
