import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrgActiveLocationId, validateLocationId } from "@/lib/location-scope";
import { requireFeature, FeatureNotAllowedError } from "@/lib/billing/entitlements";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";

const staffSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  color: z.string().optional(),
  serviceIds: z.array(z.string()).default([]),
  locationId: z.string().optional(),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const activeLocationId = await getOrgActiveLocationId(orgId);
    const staff = await prisma.staffProfile.findMany({
      where: {
        orgId,
        isActive: true,
        ...(activeLocationId ? { locationId: activeLocationId } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        services: { include: { service: { select: { id: true, name: true } } } },
        user: { select: { id: true, email: true } },
      },
    });

    return NextResponse.json({ staff });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    await requireActiveSubscription(orgId);

    try {
      await requireFeature(orgId, "staff_management");
    } catch (err) {
      if (err instanceof FeatureNotAllowedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      return NextResponse.json({ error: "Failed to verify plan limits" }, { status: 500 });
    }

    const body = await req.json();
    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const activeLocationId = (await validateLocationId(parsed.data.locationId, orgId)) ?? (await getOrgActiveLocationId(orgId));

    if (parsed.data.serviceIds.length > 0) {
      const validServices = await prisma.service.findMany({
        where: { id: { in: parsed.data.serviceIds }, orgId, isActive: true },
        select: { id: true },
      });
      if (validServices.length !== parsed.data.serviceIds.length) {
        return NextResponse.json({ error: "One or more services are invalid" }, { status: 400 });
      }
    }

    const staff = await prisma.staffProfile.create({
      data: {
        orgId,
        locationId: activeLocationId,
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
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}
