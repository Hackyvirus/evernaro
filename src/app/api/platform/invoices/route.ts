import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

const OVERDUE_AFTER_DAYS = 7;

export async function GET(req: Request) {
  try {
    await requirePlatformAdminId();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;
    const overdueBefore = new Date(Date.now() - OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000);

    const [invoices, total, paidAgg, pendingAgg, overdueCount] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { org: { select: { id: true, name: true } } },
      }),
      prisma.invoice.count(),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { amountInr: true },
      }),
      prisma.invoice.aggregate({
        where: { status: "PENDING" },
        _sum: { amountInr: true },
      }),
      prisma.invoice.count({
        where: { status: "PENDING", createdAt: { lt: overdueBefore } },
      }),
    ]);

    const summary = {
      totalPaidInr: paidAgg._sum.amountInr ?? 0,
      totalPendingInr: pendingAgg._sum.amountInr ?? 0,
      overdueCount,
    };

    return NextResponse.json(
      {
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
        total,
        page,
        limit,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
