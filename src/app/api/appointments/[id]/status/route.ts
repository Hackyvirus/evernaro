import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { updateAppointmentStatus } from "@/lib/services/appointment-service";
import { scheduleReviewRequest } from "@/lib/services/review-requests";
import { AppointmentStatus } from "@prisma/client";

const statusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
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

    await updateAppointmentStatus(id, orgId, parsed.data.status);

    if (parsed.data.status === AppointmentStatus.COMPLETED) {
      scheduleReviewRequest(id).catch((err) => {
        console.error("Failed to schedule review request:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update appointment status" }, { status: 500 });
  }
}
