import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { cancelReminderJob, enqueueReminder } from "@/lib/queue";
import { logAudit } from "@/lib/audit";

const reminderPatchSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["APPOINTMENT", "PAYMENT", "FOLLOW_UP", "CALLBACK", "CUSTOM"]).optional(),
  message: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  assignedToId: z.union([z.string().cuid2(), z.literal(null), z.literal("")]).optional(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const reminder = await prisma.reminder.findFirst({ where: { id, orgId } });
    if (!reminder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = reminderPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { title, type, message, scheduledFor, assignedToId, recurrence } = parsed.data;
    const updateData: {
      title?: string | null;
      type?: "APPOINTMENT" | "PAYMENT" | "FOLLOW_UP" | "CALLBACK" | "CUSTOM";
      message?: string;
      scheduledFor?: Date;
      assignedToId?: string | null;
      recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
    } = {};

    if (title !== undefined) updateData.title = title;
    if (type !== undefined) updateData.type = type;
    if (message !== undefined) updateData.message = message;
    if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
    if (assignedToId !== undefined) {
      if (assignedToId) {
        const user = await prisma.user.findFirst({
          where: { id: assignedToId, orgId, isActive: true },
          select: { id: true },
        });
        if (!user) {
          return NextResponse.json({ error: "Assigned user not found" }, { status: 400 });
        }
      }
      updateData.assignedToId = assignedToId || null;
    }
    if (recurrence !== undefined) updateData.recurrence = recurrence;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    // If the schedule changed and reminder is still pending, requeue.
    const needsRequeue = updateData.scheduledFor && reminder.status === "PENDING";
    if (needsRequeue) {
      await cancelReminderJob(id);
    }

    const updated = await prisma.reminder.update({
      where: { id, orgId },
      data: updateData,
      include: { contact: true, channel: { select: { type: true } }, assignedTo: { select: { id: true, name: true } } },
    });

    if (needsRequeue && updateData.scheduledFor) {
      await enqueueReminder(id, updateData.scheduledFor);
    }

    await logAudit({
      orgId,
      userId,
      action: "OTHER",
      targetType: "Reminder",
      targetId: id,
      metadata: { action: "updated", fields: Object.keys(updateData) },
    });

    return NextResponse.json({ reminder: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
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
    await prisma.reminder.update({ where: { id, orgId }, data: { status: "CANCELLED" } });

    await logAudit({
      orgId,
      userId,
      action: "REMINDER_CANCELLED",
      targetType: "Reminder",
      targetId: id,
      metadata: { alreadyRunning: !removed },
    });

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
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to cancel reminder" }, { status: 500 });
  }
}
