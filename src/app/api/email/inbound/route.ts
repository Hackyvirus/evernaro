import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateDraftReply } from "@/lib/ai";
import { secureCompare } from "@/lib/webhook-secret";

// Generic inbound-email webhook contract. Point your provider's inbound
// parse webhook (Postmark, Mailgun, SendGrid inbound parse, etc.) here,
// normalizing its payload to { to, from, subject, text } and authenticating
// with the shared secret below.
const bodySchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const secretHeader = req.headers.get("x-webhook-secret");
    if (!secureCompare(secretHeader, process.env.INBOUND_EMAIL_WEBHOOK_SECRET ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { to, from, fromName, subject, text } = parsed.data;

    const channel = await prisma.channel.findFirst({
      where: { type: "EMAIL", emailAddress: to.toLowerCase(), isActive: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "No org routes to this address" }, { status: 404 });
    }

    const contact =
      (await prisma.contact.findFirst({
        where: { orgId: channel.orgId, email: from.toLowerCase() },
      })) ??
      (await prisma.contact.create({
        data: { orgId: channel.orgId, email: from.toLowerCase(), name: fromName },
      }));

    let conversation = await prisma.conversation.findFirst({
      where: { orgId: channel.orgId, contactId: contact.id, channelId: channel.id, status: "OPEN" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          orgId: channel.orgId,
          contactId: contact.id,
          channelId: channel.id,
          subject: subject ?? "New conversation",
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        sender: "CONTACT",
        body: text,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    generateDraftReply(conversation.id).catch((err) =>
      console.error("AI draft generation failed", err)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email inbound webhook failed", err);
    // 200 rather than 500: an error here is almost always a payload/data
    // issue that will recur identically, and most providers retry on 5xx —
    // retrying a deterministic failure just hammers the same broken path.
    return NextResponse.json({ ok: true });
  }
}
