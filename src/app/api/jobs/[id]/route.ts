import { NextResponse } from "next/server";
import { z } from "zod";
import { JobCardStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const STATUS_ORDER: JobCardStatus[] = [
  JobCardStatus.RECEIVED,
  JobCardStatus.INSPECTION,
  JobCardStatus.ESTIMATE,
  JobCardStatus.APPROVED,
  JobCardStatus.IN_PROGRESS,
  JobCardStatus.QUALITY_CHECK,
  JobCardStatus.READY,
  JobCardStatus.DELIVERED,
];

function canTransition(from: JobCardStatus, to: JobCardStatus): boolean {
  if (from === to) return true;
  const fromIndex = STATUS_ORDER.indexOf(from);
  const toIndex = STATUS_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex > fromIndex;
}

const patchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    serviceId: z.string().optional(),
    staffId: z.string().optional(),
    estimateInr: z.coerce.number().int().min(0).optional(),
    status: z.nativeEnum(JobCardStatus).optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const existing = await prisma.jobCard.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { status, serviceId, staffId, ...rest } = parsed.data;

    if (status && !canTransition(existing.status, status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${existing.status} to ${status}` },
        { status: 400 }
      );
    }

    if (serviceId !== undefined) {
      if (serviceId) {
        const service = await prisma.service.findFirst({
          where: { id: serviceId, orgId },
          select: { id: true },
        });
        if (!service) {
          return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }
      }
    }

    if (staffId !== undefined) {
      if (staffId) {
        const staff = await prisma.staffProfile.findFirst({
          where: { id: staffId, orgId },
          select: { id: true },
        });
        if (!staff) {
          return NextResponse.json({ error: "Staff not found" }, { status: 404 });
        }
      }
    }

    const updateData: {
      title?: string;
      description?: string | null;
      serviceId?: string | null;
      staffId?: string | null;
      estimateInr?: number | null;
      status?: JobCardStatus;
      approvedAt?: Date | null;
      completedAt?: Date | null;
      deliveredAt?: Date | null;
    } = {};

    if (rest.title !== undefined) updateData.title = rest.title;
    if (rest.description !== undefined) updateData.description = rest.description || null;
    if (serviceId !== undefined) updateData.serviceId = serviceId || null;
    if (staffId !== undefined) updateData.staffId = staffId || null;
    if (rest.estimateInr !== undefined) updateData.estimateInr = rest.estimateInr;

    if (status && status !== existing.status) {
      updateData.status = status;
      if (status === JobCardStatus.APPROVED) updateData.approvedAt = new Date();
      if (status === JobCardStatus.READY) updateData.completedAt = new Date();
      if (status === JobCardStatus.DELIVERED) updateData.deliveredAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const updated = await prisma.jobCard.update({
      where: { id, orgId },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } },
        service: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ jobCard: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update job card" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const existing = await prisma.jobCard.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.jobCard.delete({ where: { id, orgId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete job card" }, { status: 500 });
  }
}
