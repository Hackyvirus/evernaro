import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { generateDraftReply } from "@/lib/ai";
import { logAudit } from "@/lib/audit";
import { requireFeature, FeatureNotAllowedError } from "@/lib/billing/entitlements";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);

    try {
      await requireFeature(orgId, "ai_assistant");
    } catch (err) {
      if (err instanceof FeatureNotAllowedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      return NextResponse.json({ error: "Failed to verify plan limits" }, { status: 500 });
    }

    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({ where: { id, orgId } });
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await generateDraftReply(id);

    const draft = await prisma.message.findFirst({
      where: { conversationId: id, isAiDraft: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await requireOrgMember(UserRole.AGENT);
    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({ where: { id, orgId } });
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deleted = await prisma.message.deleteMany({
      where: { conversationId: id, isAiDraft: true },
    });

    await logAudit({
      orgId,
      userId,
      action: "OTHER",
      targetType: "conversation",
      targetId: id,
      metadata: { action: "draft_discarded", count: deleted.count },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to discard draft" }, { status: 500 });
  }
}
