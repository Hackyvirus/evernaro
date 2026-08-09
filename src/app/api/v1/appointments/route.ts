import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { createAppointment, AppointmentSlotUnavailableError } from "@/lib/services/appointment-service";
import { isAppointmentWithinBusinessHours } from "@/lib/business-hours";
import { validateAppointmentRelations } from "@/lib/appointment-validation";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";
import { UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const appointmentSchema = z.object({
  contactId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  resourceId: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().optional(),
});

function requireScope(scopes: string[], scope: string) {
  return scopes.includes(scope) || scopes.includes("write");
}

async function checkApiRateLimit(request: Request, orgId: string, path: string) {
  const ip = clientIp(request);
  const allowed = await checkRateLimit(`api-v1:${path}:${orgId}:${ip}`, 100, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "appointments") && !auth.scopes.includes("read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimited = await checkApiRateLimit(request, auth.orgId, "appointments:read");
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const appointments = await prisma.appointment.findMany({
    where: {
      orgId: auth.orgId,
      ...(from ? { startsAt: { gte: new Date(from) } } : {}),
      ...(to ? { startsAt: { lte: new Date(to) } } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 100,
    include: { contact: { select: { id: true, name: true, phone: true } }, service: true, staff: true },
  });
  return NextResponse.json({ appointments });
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!requireScope(auth.scopes, "appointments")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimited = await checkApiRateLimit(request, auth.orgId, "appointments:write");
    if (rateLimited) return rateLimited;

    await requireActiveSubscription(auth.orgId);

    const parsed = appointmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { startsAt, endsAt, ...rest } = parsed.data;
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
      select: { timezone: true, businessHours: true },
    });
    if (org && !isAppointmentWithinBusinessHours(org.timezone, org.businessHours, start, end)) {
      return NextResponse.json({ error: "Appointment must be within business hours" }, { status: 400 });
    }

    const relationCheck = await validateAppointmentRelations(auth.orgId, rest);
    if (!relationCheck.ok) {
      return NextResponse.json({ error: relationCheck.error }, { status: relationCheck.status });
    }

    const appointment = await createAppointment({
      orgId: auth.orgId,
      ...rest,
      startsAt: start,
      endsAt: end,
    });

    return NextResponse.json(
      {
        appointment: {
          id: appointment.id,
          status: appointment.status,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          notes: appointment.notes,
          contact: { id: appointment.contact.id, name: appointment.contact.name },
          service: appointment.service,
          staff: appointment.staff,
          resource: appointment.resource,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AppointmentSlotUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }
}
