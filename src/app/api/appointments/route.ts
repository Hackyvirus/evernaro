import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAppointment, getAppointmentsByOrg, checkAvailability } from "@/lib/services/appointment-service";
import { AppointmentStatus } from "@prisma/client";
import { getOrgActiveLocationId } from "@/lib/location-scope";

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
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status") as AppointmentStatus | null;
  const activeLocationId = await getOrgActiveLocationId(session.user.orgId);

  const appointments = await getAppointmentsByOrg(session.user.orgId, {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    status: status ?? undefined,
    locationId: activeLocationId,
  });

  return NextResponse.json({ appointments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const activeLocationId = rest.locationId ?? (await getOrgActiveLocationId(session.user.orgId));

  if (end <= start) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const available = await checkAvailability(session.user.orgId, start, end, {
    staffId: rest.staffId,
    resourceId: rest.resourceId,
    locationId: activeLocationId,
  });

  if (!available) {
    return NextResponse.json({ error: "Time slot is not available" }, { status: 409 });
  }

  const appointment = await createAppointment({
    orgId: session.user.orgId,
    ...rest,
    locationId: activeLocationId,
    startsAt: start,
    endsAt: end,
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
