import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, MembershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

const patchSchema = z.object({
  sessionsUsed: z.coerce.number().int().min(0).optional(),
  sessionsTotal: z.coerce.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
  expiresAt: z.string().datetime().optional(),
}).strict();

function deriveStatus(
  currentStatus: MembershipStatus,
  sessionsUsed: number,
  sessionsTotal: number | null,
  expiresAt: Date | null
): MembershipStatus {
  if (currentStatus === MembershipStatus.CANCELLED) return MembershipStatus.CANCELLED;
  if (expiresAt && new Date() > expiresAt) return MembershipStatus.EXPIRED;
  if (sessionsTotal !== null && sessionsUsed >= sessionsTotal) return MembershipStatus.EXPIRED;
  return MembershipStatus.ACTIVE;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const membership = await prisma.membership.findFirst({ where: { id, orgId } });
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { sessionsUsed, sessionsTotal, status, expiresAt } = parsed.data;
    const updateData: {
      sessionsUsed?: number;
      sessionsTotal?: number | null;
      status?: MembershipStatus;
      expiresAt?: Date | null;
    } = {};

    if (sessionsUsed !== undefined) updateData.sessionsUsed = sessionsUsed;
    if (sessionsTotal !== undefined) updateData.sessionsTotal = sessionsTotal;
    if (expiresAt !== undefined) updateData.expiresAt = new Date(expiresAt);
    if (status !== undefined) {
      updateData.status = status;
    } else {
      const nextUsed = sessionsUsed ?? membership.sessionsUsed;
      const nextTotal = sessionsTotal !== undefined ? sessionsTotal : membership.sessionsTotal;
      const nextExpires = expiresAt !== undefined ? new Date(expiresAt) : membership.expiresAt;
      updateData.status = deriveStatus(membership.status, nextUsed, nextTotal, nextExpires);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const updated = await prisma.membership.update({
      where: { id, orgId },
      data: updateData,
      include: { contact: { select: { id: true, name: true, email: true, phone: true, telegramChatId: true, instagramUserId: true } } },
    });

    return NextResponse.json({ membership: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update membership" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const membership = await prisma.membership.findFirst({ where: { id, orgId } });
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.membership.delete({ where: { id, orgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to delete membership" }, { status: 500 });
  }
}
