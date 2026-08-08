import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgActiveLocationId } from "@/lib/location-scope";

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.coerce.number().int().min(1).optional(),
  priceInr: z.coerce.number().int().min(0).optional(),
  color: z.string().optional(),
  locationId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeLocationId = await getOrgActiveLocationId(session.user.orgId);
  const services = await prisma.service.findMany({
    where: {
      orgId: session.user.orgId,
      isActive: true,
      ...(activeLocationId ? { locationId: activeLocationId } : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const activeLocationId = parsed.data.locationId ?? (await getOrgActiveLocationId(session.user.orgId));

  const service = await prisma.service.create({
    data: {
      orgId: session.user.orgId,
      locationId: activeLocationId,
      name: parsed.data.name,
      description: parsed.data.description,
      durationMin: parsed.data.durationMin,
      priceInr: parsed.data.priceInr,
      color: parsed.data.color,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
