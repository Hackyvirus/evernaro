"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";

interface ChannelOption {
  id: string;
  type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
  telegramBotUsername: string | null;
  emailAddress: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  bodyText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  channel: { type: string };
}

function channelLabel(c: ChannelOption) {
  if (c.type === "TELEGRAM") return `Telegram${c.telegramBotUsername ? ` · @${c.telegramBotUsername}` : ""}`;
  if (c.type === "EMAIL") return `Email${c.emailAddress ? ` · ${c.emailAddress}` : ""}`;
  if (c.type === "WHATSAPP") return `WhatsApp${c.whatsappSourceNumber ? ` · ${c.whatsappSourceNumber}` : ""}`;
  return `Instagram${c.instagramUsername ? ` · @${c.instagramUsername}` : ""}`;
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "SENDING" || status === "QUEUED") return "info";
  if (status === "FAILED") return "danger";
  return "default";
}

// Voice is excluded from bulk campaigns — see the compliance note in
// src/app/api/campaigns/route.ts. Reachable only via individually-scheduled
// Reminders.
function campaignableChannels(channels: ChannelOption[]) {
  return channels.filter((c) => c.type !== "VOICE");
}

export default function CampaignsPage() {
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isWhatsApp = selectedChannel?.type === "WHATSAPP";
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  useEffect(() => {
    let active = true;
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => active && setChannels(d.channels ?? []));
    fetch("/api/whatsapp-templates")
      .then((r) => r.json())
      .then((d) => active && setTemplates(d.templates ?? []));

    function poll() {
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((d) => active && setCampaigns(d.campaigns ?? []))
        .finally(() => active && setLoaded(true));
    }
    poll();
    const interval = setInterval(poll, 4000); // live-ish progress while sending
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  function refresh() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []));
  }

  async function createCampaign() {
    setStatus("saving");
    setError(null);
    const chosenTemplate = approvedTemplates.find((t) => t.id === whatsappTemplateId);
    const finalMessage = isWhatsApp && chosenTemplate ? chosenTemplate.bodyText : messageTemplate;
    let res: Response;
    let data;
    try {
      res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channelId,
          messageTemplate: finalMessage,
          whatsappTemplateId: isWhatsApp ? whatsappTemplateId : undefined,
        }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to create campaign");
      return;
    }
    setStatus("idle");
    setName("");
    setMessageTemplate("");
    setWhatsappTemplateId("");
    refresh();
  }

  const canSend = isWhatsApp
    ? Boolean(name && channelId && whatsappTemplateId)
    : Boolean(name && channelId && messageTemplate);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">Campaigns</h1>
        <p className="text-sm text-text-secondary">
          Send a message to every contact reachable on a channel.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="w-full flex-shrink-0 lg:max-w-md">
          <h2 className="mb-3 text-sm font-medium text-text">New campaign</h2>
          <Card className="flex flex-col gap-3 p-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wakad 2BHK listings — August"
            />
            <Select label="Channel" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Select a connected channel...</option>
              {campaignableChannels(channels).map((c) => (
                <option key={c.id} value={c.id}>
                  {channelLabel(c)}
                </option>
              ))}
            </Select>

            {isWhatsApp ? (
              <Select
                label="Message template"
                value={whatsappTemplateId}
                onChange={(e) => setWhatsappTemplateId(e.target.value)}
                hint={
                  approvedTemplates.length === 0
                    ? "No approved templates yet — add one in Settings → WhatsApp first."
                    : undefined
                }
              >
                <option value="">Select an approved template...</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Textarea
                label="Message"
                rows={5}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Hi {{name}}, we've just listed a new 2BHK in Wakad..."
                hint={
                  <>
                    Use <code>{"{{name}}"}</code> to personalize with each contact&apos;s name.
                  </>
                }
              />
            )}

            <Button onClick={createCampaign} loading={status === "saving"} disabled={!canSend} className="w-fit">
              {status === "saving" ? "Sending..." : "Send now"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </Card>
        </div>

        <div className="flex-1">
          <h2 className="mb-3 text-sm font-medium text-text">History</h2>
          {!loaded ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns sent yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`}>
                    <Card className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-hover">
                      <div>
                        <p className="text-sm font-medium text-text">{c.name}</p>
                        <p className="text-xs text-text-secondary">
                          {c.channel.type} · {c.totalRecipients} recipients
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right text-xs">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                        <p className="text-text-secondary">
                          {c.sentCount} sent
                          {c.failedCount > 0 ? ` · ${c.failedCount} failed` : ""}
                        </p>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
