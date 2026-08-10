import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { updateQueueEntryStatus, QueueInvalidTransitionError } from "@/lib/services/queue-service";
import { QueueEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.nativeEnum(QueueEntryStatus),
  staffId: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);

    const { id } = await params;
    const body = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    if (parsed.data.staffId) {
      const staff = await prisma.staffProfile.findFirst({
        where: { id: parsed.data.staffId, orgId, isActive: true },
        select: { id: true },
      });
      if (!staff) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 400 });
      }
    }

    await updateQueueEntryStatus(id, orgId, parsed.data.status, { staffId: parsed.data.staffId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof QueueInvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update queue entry status" }, { status: 500 });
  }
}
