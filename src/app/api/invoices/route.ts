import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const invoices = await prisma.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invoices });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
