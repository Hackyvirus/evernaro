import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.ADMIN);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        monthlyFeeInr: true,
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const latestSubscriptionInvoice = await prisma.invoice.findFirst({
      where: { orgId, type: "SUBSCRIPTION" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, amountInr: true, createdAt: true, paidAt: true },
    });

    return NextResponse.json({ org, latestSubscriptionInvoice });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 });
  }
}
