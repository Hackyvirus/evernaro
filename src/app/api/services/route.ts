import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrgActiveLocationId, validateLocationId } from "@/lib/location-scope";

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.coerce.number().int().min(1).optional(),
  priceInr: z.coerce.number().int().min(0).optional(),
  color: z.string().optional(),
  locationId: z.string().optional(),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const activeLocationId = await getOrgActiveLocationId(orgId);
    const services = await prisma.service.findMany({
      where: {
        orgId,
        isActive: true,
        ...(activeLocationId ? { locationId: activeLocationId } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ services });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);

    const body = await req.json();
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const activeLocationId = (await validateLocationId(parsed.data.locationId, orgId)) ?? (await getOrgActiveLocationId(orgId));

    const service = await prisma.service.create({
      data: {
        orgId,
        locationId: activeLocationId,
        name: parsed.data.name,
        description: parsed.data.description,
        durationMin: parsed.data.durationMin,
        priceInr: parsed.data.priceInr,
        color: parsed.data.color,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
