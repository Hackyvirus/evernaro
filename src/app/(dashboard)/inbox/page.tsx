import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/session";
import { contactLabel } from "@/lib/contact-label";
import { Badge, Button, EmptyState } from "@/components/ui";

function channelLabel(type: string, telegramBotUsername: string | null) {
  if (type === "TELEGRAM") return `Telegram${telegramBotUsername ? ` · @${telegramBotUsername}` : ""}`;
  if (type === "EMAIL") return "Email";
  return type;
}

export default async function InboxPage() {
  const orgId = await requireOrgId();
  const conversations = await prisma.conversation.findMany({
    where: { orgId },
    orderBy: { lastMessageAt: "desc" },
    include: {
      contact: true,
      channel: { select: { type: true, telegramBotUsername: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">Inbox</h1>
        <p className="text-sm text-text-secondary">Every channel, one thread list.</p>
      </header>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description={
            <>
              Connect a Telegram bot or email address in{" "}
              <Link href="/settings" className="cursor-pointer text-primary hover:text-primary-hover">
                Settings
              </Link>{" "}
              — new customer messages will show up here.
            </>
          }
          action={
            <Link href="/settings">
              <Button variant="secondary" size="sm">
                Go to Settings
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {conversations.map((c) => {
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <Link
                  href={`/inbox/${c.id}`}
                  className="flex cursor-pointer flex-col gap-1 px-6 py-3 transition-colors hover:bg-hover"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text">{contactLabel(c.contact)}</span>
                    <Badge>{channelLabel(c.channel.type, c.channel.telegramBotUsername)}</Badge>
                  </div>
                  {last && (
                    <p className="truncate text-sm text-text-secondary">
                      {last.sender === "AI" && last.isAiDraft ? "AI draft ready — " : ""}
                      {last.body}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
