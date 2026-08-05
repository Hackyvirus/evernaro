import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/whatsapp-wallet";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET() {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const wallet = await getOrCreateWallet(orgId);
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ transactions });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
  }
}
