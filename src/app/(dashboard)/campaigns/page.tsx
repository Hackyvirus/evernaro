"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Pause, Play, Copy, X, Clock, ArrowRight } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, SkeletonCard, Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useRole, isAgentOrAbove } from "../role";

interface CampaignSummary {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  scheduledAt?: string | null;
  channel: { type: string };
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "SENT") return "success";
  if (status === "SCHEDULED") return "info";
  if (status === "SENDING" || status === "QUEUED") return "info";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "PAUSED") return "warning";
  if (status === "DRAFT") return "default";
  return "default";
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function CampaignsPage() {
  const { showToast } = useToast();
  const role = useRole();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/campaigns");
        const d = await r.json();
        if (active) setCampaigns(d.campaigns ?? []);
      } catch {
        showToast("error", "Failed to load campaigns");
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [showToast]);

  async function action(id: string, actionType: "pause" | "resume" | "cancel" | "duplicate") {
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
      setCampaigns((prev) => prev.map((c) => (c.id === id ? d.campaign : c)));
      showToast("success", "Campaign updated");
    } catch {
      showToast("error", "Network error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Campaigns"
        description="Send a message to every contact reachable on a channel."
      >
        {isAgentOrAbove(role) && (
          <Link href="/campaigns/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New campaign
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="p-6">
        {!loaded ? (
          <div className="flex flex-col gap-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to reach all your contacts at once."
            action={
              isAgentOrAbove(role) ? (
                <Link href="/campaigns/new">
                  <Button>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    New campaign
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Campaign</TableHeader>
                <TableHeader>Channel</TableHeader>
                <TableHeader>Audience</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Scheduled</TableHeader>
                <TableHeader>Results</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-text hover:text-primary">
                      {c.name}
                    </Link>
                    {c.description && <p className="max-w-xs truncate text-xs text-text-secondary">{c.description}</p>}
                  </TableCell>
                  <TableCell className="text-text-secondary">{c.channel.type}</TableCell>
                  <TableCell className="text-text-secondary">{c.totalRecipients}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      {c.scheduledAt && <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                      {formatDate(c.scheduledAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-text-secondary">
                    {c.sentCount} sent · {c.failedCount} failed
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAgentOrAbove(role) && (
                        <>
                          {(c.status === "SENDING" || c.status === "SCHEDULED") && (
                            <Button size="sm" variant="ghost" onClick={() => action(c.id, "pause")} title="Pause">
                              <Pause className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {c.status === "PAUSED" && (
                            <Button size="sm" variant="ghost" onClick={() => action(c.id, "resume")} title="Resume">
                              <Play className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {c.status !== "CANCELLED" && c.status !== "COMPLETED" && c.status !== "FAILED" && (
                            <Button size="sm" variant="ghost" onClick={() => action(c.id, "cancel")} title="Cancel">
                              <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => action(c.id, "duplicate")} title="Duplicate">
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      <Link href={`/campaigns/${c.id}`}>
                        <Button size="sm" variant="secondary">
                          Report <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
