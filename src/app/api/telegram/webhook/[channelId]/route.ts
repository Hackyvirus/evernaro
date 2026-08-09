import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureCompare } from "@/lib/webhook-secret";
import { generateDraftReply } from "@/lib/ai";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit } from "@/lib/rate-limit";
import { keepAlive } from "@/lib/lifecycle";
import { hasFeature, requireUsageLimit, UsageLimitExceededError as UsageLimitError } from "@/lib/billing/entitlements";
import { recordInboundMessage } from "@/lib/messaging/inbound";
import { type TelegramUpdate, telegramWebhookSecret } from "@/lib/telegram";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!secureCompare(secretHeader, telegramWebhookSecret(channelId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Bounds worst-case AI spend if the secret ever leaks or a provider
    // retries runaway — 200 legitimate customer messages/minute is far more
    // than any real conversation volume.
    if (!(await checkRateLimit(`webhook:telegram:${channelId}`, 200, 60, { failClosed: false }))) {
      return NextResponse.json({ ok: true }); // 200, not 429 — same reasoning as below: don't invite retries
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "TELEGRAM" || !channel.isActive) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const update: TelegramUpdate = await req.json();
    const message = update.message;
    if (!message?.text || !message.chat?.id) {
      return NextResponse.json({ ok: true }); // ignore non-text updates
    }

    const telegramChatId = String(message.chat.id);
    const contactName =
      [message.from?.first_name, message.from?.username].filter(Boolean).join(" · ") || undefined;

    try {
      await requireContactLimitIfNew({ telegramChatId, name: contactName }, channel.orgId);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        return NextResponse.json({ ok: true });
      }
      throw err;
    }

    const contact = await findOrCreateContact(
      { telegramChatId, name: contactName },
      channel.orgId
    );

    const messageId = message.message_id ? `telegram:${message.chat.id}:${message.message_id}` : null;

    const conversation = await prisma.conversation.findFirst({
      where: { orgId: channel.orgId, contactId: contact.id, channelId: channel.id, status: "OPEN" },
      select: { id: true },
    });
    if (!conversation) {
      try {
        await requireUsageLimit(channel.orgId, "conversations", 1);
      } catch (err) {
        if (err instanceof UsageLimitError) return NextResponse.json({ ok: true });
        throw err;
      }
    }

    const result = await recordInboundMessage({
      orgId: channel.orgId,
      channelId: channel.id,
      contactId: contact.id,
      body: message.text,
      providerMessageId: messageId,
    });

    if (!result.isDuplicate && (await hasFeature(channel.orgId, "ai_assistant"))) {
      keepAlive(generateDraftReply(result.conversationId), "AI draft generation");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook failed", err);
    // 200 rather than 500: an error here is almost always a payload/data
    // issue that will recur identically, and Telegram retries on 5xx —
    // retrying a deterministic failure just hammers the same broken path.
    return NextResponse.json({ ok: true });
  }
}
