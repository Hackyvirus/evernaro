import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateDraftReply } from "@/lib/ai";
import { secureCompare } from "@/lib/webhook-secret";
import { findOrCreateContact, requireContactLimitIfNew, UsageLimitExceededError } from "@/lib/contact-identity";
import { keepAlive } from "@/lib/lifecycle";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasFeature } from "@/lib/billing/entitlements";

// Generic inbound-email webhook contract. Point your provider's inbound
// parse webhook (Postmark, Mailgun, SendGrid inbound parse, etc.) here,
// normalizing its payload to { to, from, fromName, subject, text, messageId }.
const bodySchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  fromName: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().min(1),
  messageId: z.string().min(1),
});

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function getOrCreateOpenConversation(
  orgId: string,
  contactId: string,
  channelId: string,
  subject?: string,
  maxRetries = 2
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.conversation.findFirst({
          where: { orgId, contactId, channelId, status: "OPEN" },
        });
        if (existing) return existing;
        return tx.conversation.create({
          data: { orgId, contactId, channelId, subject: subject ?? "New conversation" },
        });
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("Failed to find or create conversation");
}

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
    const { to, from, fromName, subject, text, messageId } = parsed.data;

    const channel = await prisma.channel.findFirst({
      where: { type: "EMAIL", emailAddress: to.toLowerCase(), isActive: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "No org routes to this address" }, { status: 404 });
    }

    const allowed = await checkRateLimit(`email-inbound:${channel.id}`, 60, 60, { failClosed: false });
    if (!allowed) {
      // Fail open for inbound email: returning 4xx/5xx can cause the provider
      // to bounce legitimate mail. Swallow the rate-limit error and ack.
      return NextResponse.json({ ok: true });
    }

    try {
      await requireContactLimitIfNew({ email: from, name: fromName }, channel.orgId);
    } catch (err) {
      if (err instanceof UsageLimitExceededError) {
        return NextResponse.json({ ok: true });
      }
      throw err;
    }

    const contact = await findOrCreateContact({ email: from, name: fromName }, channel.orgId);

    const conversation = await getOrCreateOpenConversation(
      channel.orgId,
      contact.id,
      channel.id,
      subject
    );

    const result = await prisma.$transaction(async (tx) => {
      const existingMessage = await tx.message.findUnique({
        where: {
          providerMessageId_conversationId: {
            providerMessageId: messageId,
            conversationId: conversation.id,
          },
        },
      });
      if (existingMessage) return { duplicate: true, conversationId: conversation.id };

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: "INBOUND",
          sender: "CONTACT",
          body: text,
          providerMessageId: messageId,
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return { duplicate: false, conversationId: conversation.id };
    });

    if (await hasFeature(channel.orgId, "ai_assistant")) {
      keepAlive(generateDraftReply(result.conversationId), "AI draft generation");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email inbound webhook failed", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    // 200 rather than 500: most providers retry on 5xx, and a deterministic
    // data failure would just hammer the same broken path.
    return NextResponse.json({ ok: true });
  }
}
