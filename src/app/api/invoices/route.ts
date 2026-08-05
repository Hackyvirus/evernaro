import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    // WALLET_TOPUP invoices power the wallet section instead (its own
    // transaction history via /api/wallet/transactions) — keep this list to
    // the recurring-fee invoices it was always meant to show.
    const invoices = await prisma.invoice.findMany({
      where: { orgId, type: "SUBSCRIPTION" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invoices });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
