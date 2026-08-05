"use client";

import { useMemo, useState } from "react";
import type { ConversationPriority, ConversationStatus } from "@prisma/client";
import { contactLabel as getContactLabel } from "@/lib/contact-label";
import { Button, Textarea } from "@/components/ui";
import { useRole, isAgentOrAbove } from "../../role";

type ConversationWithRelations = {
  id: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    telegramChatId: string | null;
    instagramUserId: string | null;
    company?: string | null;
    tags?: string[];
    notes?: string | null;
  };
  channel: {
    type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
    telegramBotUsername?: string | null;
    emailAddress?: string | null;
    whatsappSourceNumber?: string | null;
    instagramUsername?: string | null;
  };
  messages: {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    sender: "CONTACT" | "AGENT" | "AI";
    isAiDraft: boolean;
    createdAt: Date | string;
  }[];
};

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
  onRefresh,
}: {
  conversation: ConversationWithRelations;
  onRefresh?: () => void;
}) {
  const draft = useMemo(
    () => conversation.messages.find((m) => m.isAiDraft),
    [conversation.messages]
  );
  const sentMessages = useMemo(
    () => conversation.messages.filter((m) => !m.isAiDraft),
    [conversation.messages]
  );

  const role = useRole();
  const canReply = isAgentOrAbove(role);
  const [text, setText] = useState(draft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
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
      onRefresh?.();
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
      onRefresh?.();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setRegenerating(false);
    }
  }

  async function discardDraft() {
    setDiscarding(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/draft`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to discard draft");
        return;
      }
      if (draft && text === draft.body) setText("");
      onRefresh?.();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDiscarding(false);
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
            className={`animate-message-in flex ${m.direction === "INBOUND" ? "justify-start" : "justify-end"}`}
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
          <div className="animate-message-in flex justify-end">
            <div className="max-w-md rounded-lg border border-dashed border-warning bg-warning-light px-3 py-2 text-sm text-text">
              <p className="mb-2 text-xs font-medium tracking-wide text-warning uppercase">
                AI draft — review before sending
              </p>
              <p className="mb-2">{draft.body}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setText(draft.body)} disabled={!canReply}>
                  Use draft
                </Button>
                <Button size="sm" variant="secondary" onClick={regenerate} loading={regenerating} disabled={!canReply}>
                  Regenerate
                </Button>
                <Button size="sm" variant="ghost" onClick={discardDraft} loading={discarding} disabled={!canReply}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        {isStaleWhatsApp && (
          <p className="mb-2 rounded-md border border-warning bg-warning-light px-3 py-2 text-xs text-text">
            WhatsApp requires an approved template for messages outside the 24-hour customer service
            window. Create a Reminder with an approved template, or wait for the customer to reply.
          </p>
        )}
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={!canReply ? "Viewers can not send replies" : isStaleWhatsApp ? "Reply disabled — use a template" : "Type a reply..."}
            rows={3}
            className="flex-1 resize-none"
            disabled={isStaleWhatsApp || !canReply}
          />
          <Button onClick={send} loading={sending} disabled={!text.trim() || isStaleWhatsApp || !canReply}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
