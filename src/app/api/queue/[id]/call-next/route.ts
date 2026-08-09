import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { callNextInQueue } from "@/lib/services/queue-service";
import { prisma } from "@/lib/prisma";
import { isBusinessOpen } from "@/lib/business-hours";

const schema = z.object({
  staffId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true, businessHours: true },
    });
    if (!org || !isBusinessOpen(org.timezone, org.businessHours)) {
      return NextResponse.json({ error: "Business is currently closed" }, { status: 403 });
    }

    if (parsed.data?.staffId) {
      const staff = await prisma.staffProfile.findFirst({
        where: { id: parsed.data.staffId, orgId, isActive: true },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 400 });
      }
    }

    const entry = await callNextInQueue(id, orgId, parsed.data?.staffId);
    if (!entry) {
      return NextResponse.json({ error: "No waiting entries" }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to call next entry" }, { status: 500 });
  }
}
