import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";

export async function GET(req: Request) {
  try {
    await requirePlatformAdminId();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const action = searchParams.get("action");
    const targetType = searchParams.get("targetType");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (orgId) where.orgId = orgId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          org: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true } },
          platformAdmin: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json(
      { logs, total, page, limit },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=30",
        },
      }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
