"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, MessageSquare, Megaphone, Bell, AlertTriangle, Users } from "lucide-react";
import { Card, StatCard, PageHeader, Skeleton, Select, Badge } from "@/components/ui";

interface AnalyticsResponse {
  messages: { sent: number; received: number };
  responseRate: number | null;
  activeConversationCount: number;
  dailyTrend: Array<{ date: string; sent: number; received: number }>;
  campaigns: { campaignCount: number; totalRecipients: number; totalSent: number; totalFailed: number };
  reminders: { PENDING: number; SENT: number; FAILED: number; CANCELLED: number };
  channels: Array<{ channel: string; count: number }>;
  openByPriority: { LOW: number; MEDIUM: number; HIGH: number; URGENT: number };
}

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const priorityClasses: Record<string, string> = {
  LOW: "bg-success/10 text-success",
  MEDIUM: "bg-info/10 text-info",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-danger/10 text-danger",
};

function weekdayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function MessageTrendChart({ data }: { data: AnalyticsResponse["dailyTrend"] }) {
  const max = Math.max(1, ...data.map((d) => d.sent + d.received));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 140 }}>
        {data.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-0.5" style={{ height: "100%" }}>
            <div
              className="flex w-full flex-col justify-end overflow-hidden rounded-sm"
              style={{ height: `${((d.sent + d.received) / max) * 100}%`, minHeight: d.sent + d.received > 0 ? 4 : 0 }}
              title={`${d.date}: ${d.received} received, ${d.sent} sent`}
            >
              {d.sent > 0 && (
                <div className="w-full bg-primary" style={{ height: `${(d.sent / (d.sent + d.received || 1)) * 100}%` }} />
              )}
              {d.received > 0 && (
                <div className="w-full bg-info" style={{ height: `${(d.received / (d.sent + d.received || 1)) * 100}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <div key={d.date} className="flex-1 text-center text-[10px] text-text-muted">
            {weekdayLabel(d.date)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary" /> Sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-info" /> Received
        </span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") ?? "30d";
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchAnalytics() {
      setLoaded(false);
      try {
        const r = await fetch(`/api/analytics?range=${range}`);
        const d = await r.json();
        if (active) setData(d);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoaded(true);
      }
    }
    fetchAnalytics();
    return () => {
      active = false;
    };
  }, [range]);

  function setRange(next: string) {
    router.push(`/analytics?range=${next}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Analytics" description="How your inbox is performing.">
        <Select value={range} onChange={(e) => setRange(e.target.value)} className="h-9 w-40">
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      </PageHeader>

      {!loaded ? (
        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : !data ? (
        <p className="p-6 text-sm text-danger">Failed to load analytics.</p>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Messages sent" value={String(data.messages.sent)} icon={MessageSquare} />
            <StatCard label="Messages received" value={String(data.messages.received)} icon={MessageSquare} />
            <StatCard
              label="Response rate"
              value={data.responseRate === null ? "—" : `${data.responseRate}%`}
              icon={TrendingUp}
            />
            <StatCard label="Active conversations" value={String(data.activeConversationCount)} icon={Users} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-text">Message volume</h2>
              <MessageTrendChart data={data.dailyTrend} />
            </Card>

            <Card className="p-4">
              <h2 className="mb-4 text-sm font-medium text-text">Open conversations by priority</h2>
              <div className="space-y-2">
                {Object.entries(data.openByPriority).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <Badge className={priorityClasses[priority] ?? ""}>{priority}</Badge>
                    <span className="text-sm font-medium text-text">{count}</span>
                  </div>
                ))}
              </div>
              {Object.values(data.openByPriority).reduce((a, b) => a + b, 0) === 0 && (
                <p className="mt-4 text-sm text-text-secondary">No open conversations.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-text-muted" aria-hidden="true" />
                <h2 className="text-sm font-medium text-text">Campaigns</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Campaigns sent" value={String(data.campaigns.campaignCount)} />
                <StatCard label="Total recipients" value={String(data.campaigns.totalRecipients)} />
                <StatCard label="Delivered" value={String(data.campaigns.totalSent)} />
                <StatCard label="Failed" value={String(data.campaigns.totalFailed)} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <Bell className="h-4 w-4 text-text-muted" aria-hidden="true" />
                <h2 className="text-sm font-medium text-text">Reminders</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Pending" value={String(data.reminders.PENDING)} />
                <StatCard label="Sent" value={String(data.reminders.SENT)} />
                <StatCard label="Failed" value={String(data.reminders.FAILED)} />
                <StatCard label="Cancelled" value={String(data.reminders.CANCELLED)} />
              </div>
            </Card>
          </div>

          {data.campaigns.totalFailed > 0 && (
            <Card className="flex flex-col items-center gap-3 border-warning bg-warning-light p-4 text-center sm:flex-row sm:items-start sm:text-start">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-text">Campaign delivery issues</p>
                <p className="text-sm text-text-secondary">
                  {data.campaigns.totalFailed} campaign messages failed. Check channel credentials and wallet balance.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
