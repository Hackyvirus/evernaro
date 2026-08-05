import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId: adminId, role: adminRole } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const target = await prisma.user.findFirst({ where: { id, orgId } });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Prevent self-suspension or role change.
    if (target.id === adminId) {
      return NextResponse.json({ error: "You cannot modify your own account here" }, { status: 400 });
    }
    // Only owners can modify other owners/admins.
    if (target.role === UserRole.OWNER && adminRole !== UserRole.OWNER) {
      return NextResponse.json({ error: "Only the owner can modify the owner" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { role, isActive } = body;
    const updateData: { role?: UserRole; isActive?: boolean } = {};

    if (role && Object.values(UserRole).includes(role)) {
      if (role === UserRole.OWNER && adminRole !== UserRole.OWNER) {
        return NextResponse.json({ error: "Only the owner can assign the owner role" }, { status: 403 });
      }
      updateData.role = role;
    }
    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAudit({
      orgId,
      userId: adminId,
      action: isActive === false ? "USER_SUSPENDED" : isActive === true ? "USER_REACTIVATED" : "USER_ROLE_CHANGED",
      targetType: "user",
      targetId: id,
      metadata: updateData,
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId: adminId, role: adminRole } = await requireOrgMember(UserRole.ADMIN);
    const { id } = await params;

    const target = await prisma.user.findFirst({ where: { id, orgId } });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (target.id === adminId) {
      return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
    }
    if (target.role === UserRole.OWNER && adminRole !== UserRole.OWNER) {
      return NextResponse.json({ error: "Only the owner can remove the owner" }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      orgId,
      userId: adminId,
      action: "USER_REMOVED",
      targetType: "user",
      targetId: id,
      metadata: { email: target.email },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
  }
}
