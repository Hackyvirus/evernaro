import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createAppointment, AppointmentSlotUnavailableError } from "@/lib/services/appointment-service";
import { isAppointmentWithinBusinessHours } from "@/lib/business-hours";
import { requireFeature, FeatureNotAllowedError } from "@/lib/billing/entitlements";

const bookSchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().optional(),
  startsAt: z.string().datetime(),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  website: z.string().max(0).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, timezone: true, businessHours: true, activeLocationId: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    await requireFeature(org.id, "appointment_management");
  } catch (err) {
    if (err instanceof FeatureNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const ip = clientIp(req);
  const allowed = await checkRateLimit(`public:book:${slug}:${ip}`, 10, 15 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { serviceId, staffId, startsAt, name, phone, email, notes } = parsed.data;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, orgId: org.id, isActive: true },
    select: { durationMin: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (staffId) {
    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, orgId: org.id, isActive: true },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    const staffService = await prisma.serviceStaff.findFirst({
      where: { serviceId, staffId },
      select: { id: true },
    });
    if (!staffService) {
      return NextResponse.json(
        { error: "Selected staff is not available for this service" },
        { status: 400 }
      );
    }
  }

  const start = new Date(startsAt);
  const end = new Date(start.getTime() + (service.durationMin ?? 30) * 60000);

  const now = new Date();
  if (start.getTime() < now.getTime() - 60_000) {
    return NextResponse.json({ error: "Cannot book an appointment in the past" }, { status: 400 });
  }
  const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (start.getTime() > maxFuture.getTime()) {
    return NextResponse.json({ error: "Cannot book more than one year in advance" }, { status: 400 });
  }

  if (!isAppointmentWithinBusinessHours(org.timezone, org.businessHours, start, end)) {
    return NextResponse.json(
      { error: "Appointments are only available during business hours" },
      { status: 400 }
    );
  }

  try {
    await requireContactLimitIfNew({ name, phone, email }, org.id);
  } catch (err) {
    if (err instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }

  const contact = await findOrCreateContact({ name, phone, email }, org.id);

  try {
    const appointment = await createAppointment({
      orgId: org.id,
      contactId: contact.id,
      serviceId,
      staffId,
      locationId: org.activeLocationId,
      startsAt: start,
      endsAt: end,
      notes,
      skipAvailabilityCheck: false,
    });

    return NextResponse.json(
    {
      appointment: {
        status: appointment.status,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        service: appointment.service
          ? { name: appointment.service.name, durationMin: appointment.service.durationMin }
          : null,
        staff: appointment.staff ? { name: appointment.staff.name } : null,
      },
      contact: {
        name: appointment.contact.name,
        phone: appointment.contact.phone,
      },
    },
    { status: 201 }
  );
  } catch (err) {
    if (err instanceof AppointmentSlotUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
