import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { id } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const appointments = await prisma.appointment.findMany({
      where: { contactId: id, orgId },
      orderBy: { startsAt: "desc" },
      include: { service: true, staff: true, resource: true },
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load appointments" }, { status: 500 });
  }
}
