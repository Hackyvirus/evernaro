import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAppointment, checkAvailability } from "@/lib/services/appointment-service";

const bookSchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().optional(),
  startsAt: z.string().datetime(),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });

  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
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

  const start = new Date(startsAt);
  const end = new Date(start.getTime() + (service.durationMin ?? 30) * 60000);

  const available = await checkAvailability(org.id, start, end, { staffId });
  if (!available) {
    return NextResponse.json({ error: "Slot not available" }, { status: 409 });
  }

  // Find or create contact by phone
  let contact = await prisma.contact.findFirst({
    where: { orgId: org.id, phone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        orgId: org.id,
        name,
        phone,
        email: email || null,
      },
    });
  } else if (name && !contact.name) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name },
    });
  }

  const appointment = await createAppointment({
    orgId: org.id,
    contactId: contact.id,
    serviceId,
    staffId,
    startsAt: start,
    endsAt: end,
    notes,
  });

  return NextResponse.json({ appointment, contact }, { status: 201 });
}
