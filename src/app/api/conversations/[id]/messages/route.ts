import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";
import { sendViaChannel } from "@/lib/send";

const bodySchema = z.object({ text: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }
    const { text } = parsed.data;

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId },
      include: { contact: true, channel: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await sendViaChannel(conversation.channel, conversation.contact, text, conversation.subject ?? undefined);

    // Clear any pending AI draft now that a reply has gone out.
    await prisma.message.deleteMany({ where: { conversationId: id, isAiDraft: true } });

    const sent = await prisma.message.create({
      data: {
        conversationId: id,
        direction: "OUTBOUND",
        sender: "AGENT",
        body: text,
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({ ok: true, message: sent });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
