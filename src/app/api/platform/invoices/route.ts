import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

const OVERDUE_AFTER_DAYS = 7;

export async function GET() {
  try {
    await requirePlatformAdminId();

    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { org: { select: { id: true, name: true } } },
    });

    const overdueBefore = new Date(Date.now() - OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const summary = invoices.reduce(
      (acc, inv) => {
        if (inv.status === "PAID") acc.totalPaidInr += inv.amountInr;
        if (inv.status === "PENDING") {
          acc.totalPendingInr += inv.amountInr;
          if (new Date(inv.createdAt) < overdueBefore) acc.overdueCount += 1;
        }
        return acc;
      },
      { totalPaidInr: 0, totalPendingInr: 0, overdueCount: 0 }
    );

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        orgId: inv.org.id,
        orgName: inv.org.name,
        amountInr: inv.amountInr,
        status: inv.status,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt,
      })),
      summary,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
