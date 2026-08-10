import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channelWebhookSecret, secureCompare } from "@/lib/webhook-secret";
import { generateDraftReply } from "@/lib/ai";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { checkRateLimit } from "@/lib/rate-limit";
import { keepAlive } from "@/lib/lifecycle";
import { hasFeature, requireUsageLimit, UsageLimitExceededError as UsageLimitError } from "@/lib/billing/entitlements";
import { recordInboundMessage } from "@/lib/messaging/inbound";
import { type InstagramWebhookPayload, parseInstagramInboundBatch, verifyInstagramSignature } from "@/lib/instagram";

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

    // Meta signs the raw payload with X-Hub-Signature-256 using the app secret.
    // When META_APP_SECRET is configured, require the signature. The query secret
    // remains as defense-in-depth URL obfuscation.
    const appSecret = process.env.META_APP_SECRET;
    const signature = req.headers.get("x-hub-signature-256");
    const rawBody = await req.text();
    if (appSecret && !verifyInstagramSignature(rawBody, signature, appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Bounds worst-case AI spend if the secret ever leaks or Meta retries
    // runaway — 200 legitimate customer messages/minute is far more than any
    // real conversation volume.
    if (!(await checkRateLimit(`webhook:instagram:${channelId}`, 200, 60, { failClosed: false }))) {
      return NextResponse.json({ ok: true }); // 200, not 429 — Meta retries on non-2xx
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.type !== "INSTAGRAM" || !channel.isActive) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const body: InstagramWebhookPayload = JSON.parse(rawBody);
    const inboundMessages = parseInstagramInboundBatch(body);

    for (const inbound of inboundMessages) {
      try {
        await requireContactLimitIfNew({ instagramUserId: inbound.from }, channel.orgId);
      } catch (err) {
        if (err instanceof UsageLimitExceededError) {
          continue; // skip this message; provider will get 200 for the batch
        }
        throw err;
      }

      const contact = await findOrCreateContact(
        { instagramUserId: inbound.from },
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
          if (err instanceof UsageLimitError) continue;
          throw err;
        }
      }

      const result = await recordInboundMessage({
        orgId: channel.orgId,
        channelId: channel.id,
        contactId: contact.id,
        body: inbound.text,
        providerMessageId: inbound.mid ?? null,
      });

      if (!result.isDuplicate && (await hasFeature(channel.orgId, "ai_assistant"))) {
        keepAlive(generateDraftReply(result.conversationId), "AI draft generation");
      }
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
