import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { parseInstagramInboundBatch, type InstagramWebhookPayload } from "@/lib/instagram";
import { generateDraftReply } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

// Meta's webhook verification handshake — configure this exact URL (with the
// query param below) as the callback URL in the Meta App's Webhooks product,
// using the same value as the "Verify token".
export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && secureCompare(token, channelWebhookSecret(channelId)) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

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

    // Bounds worst-case AI spend if the secret ever leaks or Meta retries
    // runaway — 200 legitimate customer messages/minute is far more than any
    // real conversation volume.
    if (!(await checkRateLimit(`webhook:instagram:${channelId}`, 200, 60))) {
      return NextResponse.json({ ok: true }); // 200, not 429 — Meta retries on non-2xx
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "INSTAGRAM" || !channel.isActive) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const body: InstagramWebhookPayload = await req.json();
    const inboundMessages = parseInstagramInboundBatch(body);

    for (const inbound of inboundMessages) {
      const contact =
        (await prisma.contact.findFirst({
          where: { orgId: channel.orgId, instagramUserId: inbound.from },
        })) ??
        (await prisma.contact.create({
          data: { orgId: channel.orgId, instagramUserId: inbound.from },
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

      generateDraftReply(conversation.id).catch((err) =>
        console.error("AI draft generation failed", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Instagram webhook failed", err);
    // 200 rather than 500: an error here is almost always a payload/data
    // issue that will recur identically, and Meta retries on 5xx — retrying
    // a deterministic failure just hammers the same broken path forever.
    return NextResponse.json({ ok: true });
  }
}
