import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

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

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "appointments") && !auth.scopes.includes("read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const auth = await authenticateApiKey(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireScope(auth.scopes, "appointments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = appointmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      orgId: auth.orgId,
      contactId: parsed.data.contactId,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      resourceId: parsed.data.resourceId,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      notes: parsed.data.notes,
      status: AppointmentStatus.BOOKED,
    },
    include: { contact: { select: { id: true, name: true, phone: true } }, service: true, staff: true },
  });
  return NextResponse.json({ appointment }, { status: 201 });
}
