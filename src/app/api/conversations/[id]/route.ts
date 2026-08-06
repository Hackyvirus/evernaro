import { NextResponse } from "next/server";
import { UserRole, type ConversationPriority, type ConversationStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const validPriorities: ConversationPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const validStatuses: ConversationStatus[] = ["OPEN", "CLOSED"];

const conversationPatchSchema = z.object({
  assignedToId: z.union([z.string().cuid2(), z.literal(null), z.literal("")]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
}).strict();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.VIEWER);
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        channel: {
          select: {
            type: true,
            telegramBotUsername: true,
            emailAddress: true,
            whatsappSourceNumber: true,
            instagramUsername: true,
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId, role } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const parsed = conversationPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { assignedToId, priority, status } = parsed.data;

    const existing = await prisma.conversation.findFirst({
      where: { id, orgId },
      select: { id: true, status: true, assignedToId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // VIEWER can only read; AGENT cannot change assignment unless admin.
    const canManageAssignment = role === UserRole.OWNER || role === UserRole.ADMIN;

    const updateData: {
      assignedToId?: string | null;
      priority?: ConversationPriority;
      status?: ConversationStatus;
      closedAt?: Date | null;
      closedById?: string | null;
    } = {};

    if (priority && validPriorities.includes(priority)) {
      updateData.priority = priority;
    }

    if (status && validStatuses.includes(status)) {
      updateData.status = status;
      if (status === "CLOSED" && existing.status !== "CLOSED") {
        updateData.closedAt = new Date();
        updateData.closedById = userId;
      } else if (status === "OPEN") {
        updateData.closedAt = null;
        updateData.closedById = null;
      }
    }

    if (assignedToId !== undefined) {
      if (assignedToId === null) {
        updateData.assignedToId = null;
      } else if (canManageAssignment) {
        const user = await prisma.user.findFirst({
          where: { id: assignedToId, orgId, isActive: true },
          select: { id: true },
        });
        if (!user) {
          return NextResponse.json({ error: "Assigned user not found" }, { status: 400 });
        }
        updateData.assignedToId = assignedToId;
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit({
      orgId,
      userId,
      action: "CONVERSATION_UPDATED",
      targetType: "conversation",
      targetId: id,
      metadata: { priority: updated.priority, status: updated.status, assignedToId: updated.assignedToId },
    });

    return NextResponse.json({ conversation: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
