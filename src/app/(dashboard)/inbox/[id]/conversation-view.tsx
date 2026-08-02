"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { contactLabel as getContactLabel } from "@/lib/contact-label";
import { Button, Textarea } from "@/components/ui";

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: {
    contact: true;
    channel: {
      select: {
        type: true;
        telegramBotUsername: true;
        emailAddress: true;
        whatsappSourceNumber: true;
        instagramUsername: true;
      };
    };
    messages: true;
  };
}>;

function isOlderThan24h(date: Date | string) {
  return Date.now() - new Date(date).getTime() > 24 * 60 * 60 * 1000;
}

function channelLabel(channel: ConversationWithRelations["channel"]) {
  if (channel.type === "TELEGRAM")
    return `Telegram${channel.telegramBotUsername ? ` · @${channel.telegramBotUsername}` : ""}`;
  if (channel.type === "EMAIL") return `Email${channel.emailAddress ? ` · ${channel.emailAddress}` : ""}`;
  if (channel.type === "WHATSAPP")
    return `WhatsApp${channel.whatsappSourceNumber ? ` · ${channel.whatsappSourceNumber}` : ""}`;
  return `Instagram${channel.instagramUsername ? ` · @${channel.instagramUsername}` : ""}`;
}

export function ConversationView({
  conversation,
}: {
  conversation: ConversationWithRelations;
}) {
  const router = useRouter();
  const draft = useMemo(
    () => conversation.messages.find((m) => m.isAiDraft),
    [conversation.messages]
  );
  const sentMessages = useMemo(
    () => conversation.messages.filter((m) => !m.isAiDraft),
    [conversation.messages]
  );

  const [text, setText] = useState(draft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactLabel = getContactLabel(conversation.contact);

  // Meta rejects free-text WhatsApp replies once 24 hours have passed since
  // the contact's last inbound message — only a pre-approved template can
  // reach them after that. Warn before the agent hits send into a rejection.
  const lastInboundAt = useMemo(() => {
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].direction === "INBOUND") return conversation.messages[i].createdAt;
    }
    return null;
  }, [conversation.messages]);
  const isStaleWhatsApp =
    conversation.channel.type === "WHATSAPP" && (!lastInboundAt || isOlderThan24h(lastInboundAt));

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to send message");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/draft`, { method: "POST" });
      if (!res.ok) {
        setError("Failed to generate a draft (is ANTHROPIC_API_KEY configured?)");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-sm font-semibold text-text">{contactLabel}</h1>
        <p className="text-xs text-text-secondary">{channelLabel(conversation.channel)}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
        {sentMessages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "INBOUND" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-md rounded-lg px-3 py-2 text-sm ${
                m.direction === "INBOUND"
                  ? "bg-card text-text shadow-[var(--shadow-card)]"
                  : "bg-primary text-white"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}

        {draft && (
          <div className="flex justify-end">
            <div className="max-w-md rounded-lg border border-dashed border-warning bg-warning-light px-3 py-2 text-sm text-text">
              <p className="mb-1 text-xs font-medium tracking-wide text-warning uppercase">
                AI draft — review before sending
              </p>
              {draft.body}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        {isStaleWhatsApp && (
          <p className="mb-2 rounded-md border border-warning bg-warning-light px-3 py-2 text-xs text-text">
            This contact hasn&apos;t messaged in over 24 hours — WhatsApp will likely reject a free-text
            reply. Use an approved template from a Reminder instead, or wait for them to write in again.
          </p>
        )}
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a reply..."
            rows={3}
            className="flex-1 resize-none"
          />
          <div className="flex flex-col gap-2">
            <Button onClick={send} loading={sending} disabled={!text.trim()}>
              {sending ? "Sending..." : "Send"}
            </Button>
            <Button onClick={regenerate} loading={regenerating} variant="secondary">
              {regenerating ? "Thinking..." : "AI draft"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
