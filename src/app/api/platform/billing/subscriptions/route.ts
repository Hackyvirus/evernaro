import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET(req: Request) {
  try {
    await requirePlatformAdminId();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.toLowerCase() ?? "";

    const subscriptions = await prisma.customerSubscription.findMany({
      where: query
        ? {
            OR: [
              { org: { name: { contains: query, mode: "insensitive" } } },
              { org: { slug: { contains: query, mode: "insensitive" } } },
              { razorpaySubscriptionId: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            razorpayCustomerId: true,
            users: { where: { role: "OWNER" }, select: { email: true, name: true } },
          },
        },
        plan: { select: { id: true, name: true, slug: true, monthlyPriceInr: true, annualPriceInr: true } },
        items: { include: { addOn: { select: { name: true } } } },
        invoices: { orderBy: { createdAt: "desc" }, take: 5 },
        payments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      take: 500,
    });

    return NextResponse.json({ subscriptions });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Platform subscriptions error:", err);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}
