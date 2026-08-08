import { prisma } from "@/lib/prisma";
import { AppointmentStatus, CustomerEventType, type Prisma } from "@prisma/client";
import { recordCustomerEvent } from "@/lib/customer-events";
import { scheduleAppointmentReminders } from "./appointment-reminders";

export type CreateAppointmentInput = {
  orgId: string;
  contactId: string;
  serviceId?: string;
  staffId?: string;
  resourceId?: string;
  locationId?: string | null;
  startsAt: Date;
  endsAt: Date;
  notes?: string;
  depositInr?: number;
};

export async function createAppointment(input: CreateAppointmentInput) {
  const appointment = await prisma.appointment.create({
    data: {
      orgId: input.orgId,
      locationId: input.locationId,
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

  // Schedule automatic reminders in the background; do not fail appointment
  // creation if reminder scheduling hits a missing template/channel.
  scheduleAppointmentReminders(appointment.id).catch((err) => {
    console.error("Failed to schedule appointment reminders:", err);
  });

  // Record timeline event for the customer.
  void recordCustomerEvent(
    appointment.orgId,
    appointment.contactId,
    CustomerEventType.APPOINTMENT_BOOKED,
    "appointment",
    appointment.id,
    {
      serviceName: appointment.service?.name ?? null,
      staffName: appointment.staff?.name ?? null,
      resourceName: appointment.resource?.name ?? null,
      startsAt: appointment.startsAt.toISOString(),
    }
  );

  return appointment;
}

export async function getAppointmentsByOrg(orgId: string, options?: { from?: Date; to?: Date; status?: AppointmentStatus; locationId?: string | null }) {
  const where: Prisma.AppointmentWhereInput = { orgId };
  if (options?.from || options?.to) {
    where.startsAt = {};
    if (options.from) where.startsAt.gte = options.from;
    if (options.to) where.startsAt.lte = options.to;
  }
  if (options?.status) where.status = options.status;
  if (options?.locationId) where.locationId = options.locationId;

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
  const result = await prisma.appointment.updateMany({
    where: { id, orgId },
    data: { status },
  });

  if (result.count > 0 && status === AppointmentStatus.COMPLETED) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId },
      select: {
        contactId: true,
        service: { select: { name: true } },
        startsAt: true,
      },
    });
    if (appointment) {
      void recordCustomerEvent(
        orgId,
        appointment.contactId,
        CustomerEventType.SERVICE_COMPLETED,
        "appointment",
        id,
        {
          serviceName: appointment.service?.name ?? null,
          startsAt: appointment.startsAt.toISOString(),
        }
      );
    }
  }

  return result;
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
  options?: { staffId?: string; resourceId?: string; excludeId?: string; locationId?: string | null }
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
  if (options?.locationId) where.locationId = options.locationId;

  const conflicts = await prisma.appointment.findMany({
    where,
    select: { id: true, startsAt: true, endsAt: true },
  });

  return conflicts.length === 0;
}
