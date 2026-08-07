import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const staffSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  color: z.string().optional(),
  serviceIds: z.array(z.string()).default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staffProfile.findMany({
    where: { orgId: session.user.orgId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      services: { include: { service: { select: { id: true, name: true } } } },
      user: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const staff = await prisma.staffProfile.create({
    data: {
      orgId: session.user.orgId,
      name: parsed.data.name,
      role: parsed.data.role,
      phone: parsed.data.phone,
      email: parsed.data.email,
      color: parsed.data.color,
      services: {
        create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })),
      },
    },
    include: {
      services: { include: { service: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ staff }, { status: 201 });
}
