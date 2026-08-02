import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { cancelReminderJob } from "@/lib/queue";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId();
    const { id } = await params;

    const reminder = await prisma.reminder.findFirst({ where: { id, orgId } });
    if (!reminder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (reminder.status !== "PENDING") {
      return NextResponse.json(
        { error: "This reminder has already been sent, cancelled, or failed" },
        { status: 400 }
      );
    }

    const { removed } = await cancelReminderJob(id);
    await prisma.reminder.update({ where: { id }, data: { status: "CANCELLED" } });

    if (!removed) {
      return NextResponse.json({
        ok: true,
        warning: "This reminder was already being sent when you cancelled it — it may still go out.",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to cancel reminder" }, { status: 500 });
  }
}
