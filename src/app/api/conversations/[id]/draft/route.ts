import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { generateDraftReply } from "@/lib/ai";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId();
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
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}
