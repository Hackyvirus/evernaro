import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { joinQueue } from "@/lib/services/queue-service";

const joinSchema = z.object({
  queueId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().min(5),
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
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { queueId, serviceId, staffId, name, phone } = parsed.data;

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, orgId: org.id, isActive: true },
    select: { id: true },
  });
  if (!queue) {
    return NextResponse.json({ error: "Queue not found" }, { status: 404 });
  }

  let contact = await prisma.contact.findFirst({
    where: { orgId: org.id, phone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { orgId: org.id, name, phone },
    });
  } else if (name && !contact.name) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name },
    });
  }

  const entry = await joinQueue({
    orgId: org.id,
    queueId,
    contactId: contact.id,
    serviceId,
    staffId,
  });

  return NextResponse.json(
    {
      entry: {
        id: entry.id,
        token: entry.token,
        publicToken: entry.publicToken,
        verificationCode: entry.verificationCode,
        position: entry.position,
        estimatedWaitMin: entry.estimatedWaitMin,
        queue: entry.queue,
      },
    },
    { status: 201 }
  );
}
