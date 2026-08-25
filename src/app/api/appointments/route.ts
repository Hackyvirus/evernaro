import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createAppointment, getAppointmentsByOrg, AppointmentSlotUnavailableError } from "@/lib/services/appointment-service";
import { AppointmentStatus } from "@prisma/client";
import { getOrgActiveLocationId } from "@/lib/location-scope";
import { isAppointmentWithinBusinessHours } from "@/lib/business-hours";
import { validateAppointmentRelations } from "@/lib/appointment-validation";
import { requireFeature, FeatureNotAllowedError } from "@/lib/billing/entitlements";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";

const appointmentSchema = z.object({
  contactId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  resourceId: z.string().optional(),
  locationId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().optional(),
  depositInr: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status") as AppointmentStatus | null;
    const activeLocationId = await getOrgActiveLocationId(orgId);

    const appointments = await getAppointmentsByOrg(orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status: status ?? undefined,
      locationId: activeLocationId,
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load appointments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);
    await requireFeature(orgId, "appointment_management");

    const body = await req.json();
    const parsed = appointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { startsAt, endsAt, ...rest } = parsed.data;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const activeLocationId = rest.locationId ?? (await getOrgActiveLocationId(orgId));

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true, businessHours: true },
    });
    if (org && !isAppointmentWithinBusinessHours(org.timezone, org.businessHours, start, end)) {
      return NextResponse.json({ error: "Appointment must be within business hours" }, { status: 400 });
    }

    const now = new Date();
    if (start.getTime() < now.getTime() - 60_000) {
      return NextResponse.json({ error: "Cannot book an appointment in the past" }, { status: 400 });
    }
    const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (start.getTime() > maxFuture.getTime()) {
      return NextResponse.json({ error: "Cannot book more than one year in advance" }, { status: 400 });
    }

    const relationCheck = await validateAppointmentRelations(orgId, {
      contactId: rest.contactId,
      serviceId: rest.serviceId,
      staffId: rest.staffId,
      resourceId: rest.resourceId,
      locationId: activeLocationId,
    });
    if (!relationCheck.ok) {
      return NextResponse.json({ error: relationCheck.error }, { status: relationCheck.status });
    }

    try {
      const appointment = await createAppointment({
        orgId,
        ...rest,
        locationId: activeLocationId,
        startsAt: start,
        endsAt: end,
      });

      return NextResponse.json({ appointment }, { status: 201 });
    } catch (err) {
      if (err instanceof AppointmentSlotUnavailableError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof AppointmentSlotUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof FeatureNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("POST /api/appointments failed:", err);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
