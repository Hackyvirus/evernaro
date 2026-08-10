import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { bigintAdvisoryKey } from "@/lib/keys";

interface InboundMessageData {
  orgId: string;
  channelId: string;
  contactId: string;
  body: string;
  providerMessageId?: string | null;
}

/**
 * Atomically record an inbound messaging-webhook event.
 *
 * - Acquires an advisory lock keyed by the provider message id so concurrent
 *   retries of the same webhook event serialize instead of racing.
 * - Idempotently returns an existing message when the provider message id has
 *   already been recorded.
 * - Creates/finds the open conversation for the contact atomically and handles
 *   the partial-unique race on OPEN conversations.
 */
export async function recordInboundMessage(data: InboundMessageData) {
  const { orgId, channelId, contactId, body, providerMessageId } = data;

  return prisma.$transaction(async (tx) => {
    if (providerMessageId) {
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock($1)",
        bigintAdvisoryKey(`inbound:${providerMessageId}`)
      );

      const existing = await tx.message.findUnique({
        where: { providerMessageId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, isDuplicate: true as const };
    }

    let conversation = await tx.conversation.findFirst({
      where: { orgId, contactId, channelId, status: "OPEN" },
      select: { id: true },
    });

    if (!conversation) {
      try {
        conversation = await tx.conversation.create({
          data: { orgId, contactId, channelId },
          select: { id: true },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          conversation = await tx.conversation.findFirst({
            where: { orgId, contactId, channelId, status: "OPEN" },
            select: { id: true },
          });
        }
        if (!conversation) throw err;
      }
    }

    try {
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: "INBOUND",
          sender: "CONTACT",
          body,
          providerMessageId: providerMessageId ?? null,
        },
        select: { id: true, conversationId: true },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return { id: message.id, conversationId: message.conversationId, isDuplicate: false as const };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        providerMessageId
      ) {
        const existing = await tx.message.findUnique({
          where: { providerMessageId },
          select: { id: true },
        });
        if (existing) return { id: existing.id, isDuplicate: true as const };
      }
      throw err;
    }
  });
}
