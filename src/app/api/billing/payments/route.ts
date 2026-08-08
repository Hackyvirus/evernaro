import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const payments = await prisma.payment.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: {
        invoice: { select: { id: true, type: true } },
        subscription: { select: { id: true, plan: { select: { name: true } } } },
      },
      take: 100,
    });
    return NextResponse.json({ payments });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
