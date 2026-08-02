"use client";

import { useEffect, useState, use } from "react";
import { contactLabel } from "@/lib/contact-label";
import { Badge, Spinner, StatCard } from "@/components/ui";

interface Recipient {
  id: string;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  sentAt: string | null;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    telegramChatId: string | null;
    instagramUserId: string | null;
  };
}

interface CampaignDetail {
  id: string;
  name: string;
  messageTemplate: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  channel: { type: string };
  recipients: Recipient[];
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "SENT") return "success";
  if (status === "SENDING" || status === "QUEUED") return "info";
  if (status === "FAILED") return "danger";
  return "default";
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);

  useEffect(() => {
    let active = true;
    function load() {
      fetch(`/api/campaigns/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (active) setCampaign(d.campaign ?? null);
        });
    }
    load();
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  if (!campaign) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-text-secondary">
        <Spinner className="h-4 w-4" />
        Loading...
      </div>
    );
  }

  const pending = campaign.totalRecipients - campaign.sentCount - campaign.failedCount;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">{campaign.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
          {campaign.channel.type} · <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 border-b border-border px-6 py-4 sm:grid-cols-4">
        <StatCard label="Total" value={String(campaign.totalRecipients)} />
        <StatCard label="Sent" value={String(campaign.sentCount)} />
        <StatCard label="Failed" value={String(campaign.failedCount)} />
        <StatCard label="Pending" value={String(pending)} />
      </div>

      <div className="px-6 py-4">
        <p className="mb-4 rounded-md bg-surface px-3 py-2 text-sm text-text-secondary">
          {campaign.messageTemplate}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 font-medium">Contact</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-border transition-colors hover:bg-hover">
                  <td className="py-2 text-text">{contactLabel(r.contact)}</td>
                  <td className="py-2">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="py-2 text-text-secondary">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
