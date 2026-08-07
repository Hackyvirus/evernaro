import { prisma } from "@/lib/prisma";
import { AppointmentStatus, type Prisma } from "@prisma/client";

export type CreateAppointmentInput = {
  orgId: string;
  contactId: string;
  serviceId?: string;
  staffId?: string;
  resourceId?: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string;
  depositInr?: number;
};

export async function createAppointment(input: CreateAppointmentInput) {
  return prisma.appointment.create({
    data: {
      orgId: input.orgId,
      contactId: input.contactId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      resourceId: input.resourceId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes,
      depositInr: input.depositInr,
      status: AppointmentStatus.BOOKED,
    },
    include: {
      contact: true,
      service: true,
      staff: true,
      resource: true,
    },
  });
}

export async function getAppointmentsByOrg(orgId: string, options?: { from?: Date; to?: Date; status?: AppointmentStatus }) {
  const where: Prisma.AppointmentWhereInput = { orgId };
  if (options?.from || options?.to) {
    where.startsAt = {};
    if (options.from) where.startsAt.gte = options.from;
    if (options.to) where.startsAt.lte = options.to;
  }
  if (options?.status) where.status = options.status;

  return prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      contact: true,
      service: true,
      staff: true,
      resource: true,
    },
  });
}

export async function getAppointmentById(id: string, orgId: string) {
  return prisma.appointment.findFirst({
    where: { id, orgId },
    include: {
      contact: true,
      service: true,
      staff: true,
      resource: true,
    },
  });
}

export async function updateAppointment(
  id: string,
  orgId: string,
  data: Partial<CreateAppointmentInput> & { status?: AppointmentStatus }
) {
  return prisma.appointment.updateMany({
    where: { id, orgId },
    data: {
      contactId: data.contactId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      resourceId: data.resourceId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      notes: data.notes,
      depositInr: data.depositInr,
      status: data.status,
    },
  });
}

export async function updateAppointmentStatus(id: string, orgId: string, status: AppointmentStatus) {
  return prisma.appointment.updateMany({
    where: { id, orgId },
    data: { status },
  });
}

export async function deleteAppointment(id: string, orgId: string) {
  return prisma.appointment.deleteMany({
    where: { id, orgId },
  });
}

export async function checkAvailability(
  orgId: string,
  startsAt: Date,
  endsAt: Date,
  options?: { staffId?: string; resourceId?: string; excludeId?: string }
) {
  const where: Prisma.AppointmentWhereInput = {
    orgId,
    status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
    OR: [
      { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    ],
  };

  if (options?.staffId) where.staffId = options.staffId;
  if (options?.resourceId) where.resourceId = options.resourceId;
  if (options?.excludeId) where.id = { not: options.excludeId };

  const conflicts = await prisma.appointment.findMany({
    where,
    select: { id: true, startsAt: true, endsAt: true },
  });

  return conflicts.length === 0;
}
