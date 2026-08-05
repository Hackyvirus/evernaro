"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, Play, Copy, X } from "lucide-react";
import { contactLabel } from "@/lib/contact-label";
import { Badge, Button, Spinner, StatCard } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useRole, isAgentOrAbove } from "../../role";

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
  if (status === "SCHEDULED" || status === "SENDING" || status === "QUEUED") return "info";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "PAUSED") return "warning";
  if (status === "DRAFT") return "default";
  return "default";
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast } = useToast();
  const role = useRole();
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

  async function action(actionType: "pause" | "resume" | "cancel" | "duplicate") {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast("error", d.error ?? "Action failed");
        return;
      }
      setCampaign(d.campaign);
      showToast("success", "Campaign updated");
    } catch {
      showToast("error", "Network error");
    }
  }

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
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/campaigns" className="mb-1 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Campaigns
          </Link>
          <h1 className="text-xl font-bold text-text">{campaign.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
            {campaign.channel.type} · <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
          </p>
        </div>
        {isAgentOrAbove(role) && (
          <div className="flex flex-wrap items-center gap-2">
            {(campaign.status === "SENDING" || campaign.status === "SCHEDULED") && (
              <Button size="sm" variant="secondary" onClick={() => action("pause")}>
                <Pause className="mr-1.5 h-4 w-4" aria-hidden="true" /> Pause
              </Button>
            )}
            {campaign.status === "PAUSED" && (
              <Button size="sm" variant="secondary" onClick={() => action("resume")}>
                <Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> Resume
              </Button>
            )}
            {campaign.status !== "CANCELLED" && campaign.status !== "COMPLETED" && campaign.status !== "FAILED" && (
              <Button size="sm" variant="ghost" onClick={() => action("cancel")}>
                <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => action("duplicate")}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Duplicate
            </Button>
          </div>
        )}
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

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-text-secondary">
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Contact</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Status</th>
                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Detail</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-hover">
                  <td className="px-3 py-2.5 text-text">{contactLabel(r.contact)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
