import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { parseGupshupInbound, type GupshupInboundPayload } from "@/lib/whatsapp";
import { generateDraftReply } from "@/lib/ai";
import { normalizePhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import { keepAlive } from "@/lib/lifecycle";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    const secret = new URL(req.url).searchParams.get("secret");
    if (!secureCompare(secret, channelWebhookSecret(channelId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Bounds worst-case AI spend if the secret ever leaks or Gupshup retries
    // runaway — 200 legitimate customer messages/minute is far more than any
    // real conversation volume.
    if (!(await checkRateLimit(`webhook:whatsapp:${channelId}`, 200, 60))) {
      return NextResponse.json({ ok: true }); // 200, not 429 — Gupshup retries on non-2xx
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "WHATSAPP" || !channel.isActive) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const body: GupshupInboundPayload = await req.json();
    const inbound = parseGupshupInbound(body);
    if (!inbound) {
      return NextResponse.json({ ok: true }); // ignore non-text/status updates
    }

    const phone = normalizePhone(inbound.from); // Gupshup sends numbers without a leading '+'

    const contact =
      (await prisma.contact.findFirst({
        where: { orgId: channel.orgId, phone },
      })) ??
      (await prisma.contact.create({
        data: { orgId: channel.orgId, phone, name: inbound.name },
      }));

    let conversation = await prisma.conversation.findFirst({
      where: { orgId: channel.orgId, contactId: contact.id, channelId: channel.id, status: "OPEN" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { orgId: channel.orgId, contactId: contact.id, channelId: channel.id },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        sender: "CONTACT",
        body: inbound.text,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    keepAlive(generateDraftReply(conversation.id), "AI draft generation");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook failed", err);
    // 200 rather than 500: an error here is almost always a payload/data
    // issue that will recur identically, and Gupshup retries on 5xx —
    // retrying a deterministic failure just hammers the same broken path.
    return NextResponse.json({ ok: true });
  }
}
