import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/session";
import { ConversationView } from "./conversation-view";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, orgId },
    include: {
      contact: true,
      channel: {
        select: {
          type: true,
          telegramBotUsername: true,
          emailAddress: true,
          whatsappSourceNumber: true,
          instagramUsername: true,
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) notFound();

  return <ConversationView conversation={conversation} />;
}
