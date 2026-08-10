import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getQueuesByOrg, createQueue, joinQueue, QueueDuplicateJoinError } from "@/lib/services/queue-service";
import { getOrgActiveLocationId, validateLocationId } from "@/lib/location-scope";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";
import { isBusinessOpen } from "@/lib/business-hours";

const createQueueSchema = z.object({
  name: z.string().min(1),
  serviceId: z.string().optional(),
  locationId: z.string().optional(),
});

const joinQueueSchema = z.object({
  queueId: z.string().min(1),
  contactId: z.string().min(1),
  serviceId: z.string().optional(),
  staffId: z.string().optional(),
});

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);

    const activeLocationId = await getOrgActiveLocationId(orgId);
    const queues = await getQueuesByOrg(orgId, activeLocationId);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });

    return NextResponse.json({ queues, orgSlug: org?.slug });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load queues" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);

    const body = await req.json();
    const parsed = createQueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const activeLocationId = (await validateLocationId(parsed.data.locationId, orgId)) ?? (await getOrgActiveLocationId(orgId));

    if (parsed.data.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: parsed.data.serviceId, orgId, isActive: true },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 400 });
      }
    }

    const queue = await createQueue(orgId, { ...parsed.data, locationId: activeLocationId });
    return NextResponse.json({ queue }, { status: 201 });
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
    return NextResponse.json({ error: "Failed to create queue" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);

    const body = await req.json();
    const parsed = joinQueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const queue = await prisma.queue.findFirst({
      where: { id: parsed.data.queueId, orgId },
      select: { id: true },
    });
    if (!queue) {
      return NextResponse.json({ error: "Queue not found" }, { status: 404 });
    }
    const contact = await prisma.contact.findFirst({
      where: { id: parsed.data.contactId, orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (parsed.data.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: parsed.data.serviceId, orgId, isActive: true },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 400 });
      }
    }
    if (parsed.data.staffId) {
      const staff = await prisma.staffProfile.findFirst({
        where: { id: parsed.data.staffId, orgId, isActive: true },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 400 });
      }
    }

    const orgHours = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true, businessHours: true },
    });
    const businessOpen = orgHours ? isBusinessOpen(orgHours.timezone, orgHours.businessHours) : false;

    try {
      const entry = await joinQueue({
        orgId,
        ...parsed.data,
        isAfterHours: !businessOpen,
      });

      return NextResponse.json({ entry }, { status: 201 });
    } catch (innerErr) {
      if (innerErr instanceof QueueDuplicateJoinError) {
        return NextResponse.json(
          { error: "Contact already has an active entry in this queue" },
          { status: 409 }
        );
      }
      throw innerErr;
    }
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
    return NextResponse.json({ error: "Failed to join queue" }, { status: 500 });
  }
}
