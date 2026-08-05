import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { sendViaChannel } from "@/lib/send";
import { InsufficientWalletBalanceError } from "@/lib/whatsapp-wallet";
import { requireActiveSubscription, SubscriptionSuspendedError } from "@/lib/subscription";

const bodySchema = z.object({ text: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);
    await requireActiveSubscription(orgId);
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
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof SubscriptionSuspendedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof InsufficientWalletBalanceError) {
      return NextResponse.json(
        { error: "WhatsApp balance is too low to send this message — top up from Billing." },
        { status: 402 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
