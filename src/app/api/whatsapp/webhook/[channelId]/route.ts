import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { parseGupshupInbound, type GupshupInboundPayload } from "@/lib/whatsapp";
import { generateDraftReply } from "@/lib/ai";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit } from "@/lib/rate-limit";
import { keepAlive } from "@/lib/lifecycle";
import { hasFeature, requireUsageLimit, UsageLimitExceededError as UsageLimitError } from "@/lib/billing/entitlements";
import { recordInboundMessage } from "@/lib/messaging/inbound";

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
    if (!(await checkRateLimit(`webhook:whatsapp:${channelId}`, 200, 60, { failClosed: false }))) {
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

    try {
      await requireContactLimitIfNew({ phone: inbound.from, name: inbound.name }, channel.orgId);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        // Return 200 so the provider does not retry; the contact limit is enforced.
        return NextResponse.json({ ok: true });
      }
      throw err;
    }

    const contact = await findOrCreateContact(
      { phone: inbound.from, name: inbound.name },
      channel.orgId
    );

    const conversation = await prisma.conversation.findFirst({
      where: { orgId: channel.orgId, contactId: contact.id, channelId: channel.id, status: "OPEN" },
      select: { id: true },
    });
    if (!conversation) {
      try {
        await requireUsageLimit(channel.orgId, "conversations", 1);
      } catch (err) {
        if (err instanceof UsageLimitError) {
          return NextResponse.json({ ok: true });
        }
        throw err;
      }
    }

    const result = await recordInboundMessage({
      orgId: channel.orgId,
      channelId: channel.id,
      contactId: contact.id,
      body: inbound.text,
      providerMessageId: inbound.messageId ?? null,
    });

    if (!result.isDuplicate && (await hasFeature(channel.orgId, "ai_assistant"))) {
      keepAlive(generateDraftReply(result.conversationId), "AI draft generation");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook failed", err);
    // 200 rather than 500: an error here is almost always a payload/data
    // issue that will recur identically, and Gupshup retries on 5xx —
    // retrying a deterministic failure just hammers the same broken path.
    return NextResponse.json({ ok: true });
  }
}
