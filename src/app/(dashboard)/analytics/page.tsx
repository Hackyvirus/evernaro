"use client";

import { useEffect, useState } from "react";
import { Card, StatCard } from "@/components/ui";

interface AnalyticsResponse {
  messages: { sent: number; received: number };
  responseRate: number | null;
  activeConversationCount: number;
  dailyTrend: Array<{ date: string; sent: number; received: number }>;
  campaigns: { campaignCount: number; totalRecipients: number; totalSent: number; totalFailed: number };
  reminders: { PENDING: number; SENT: number; FAILED: number; CANCELLED: number };
}

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
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">Analytics</h1>
        <p className="text-sm text-text-secondary">How your inbox is performing — last 30 days.</p>
      </header>

      {!loaded ? (
        <p className="p-6 text-sm text-text-secondary">Loading...</p>
      ) : !data ? (
        <p className="p-6 text-sm text-danger">Failed to load analytics.</p>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Messages sent" value={String(data.messages.sent)} />
            <StatCard label="Messages received" value={String(data.messages.received)} />
            <StatCard
              label="Response rate"
              value={data.responseRate === null ? "—" : `${data.responseRate}%`}
            />
            <StatCard label="Active conversations" value={String(data.activeConversationCount)} />
          </div>

          <Card className="p-4">
            <h2 className="mb-4 text-sm font-medium text-text">Message volume — last 14 days</h2>
            <MessageTrendChart data={data.dailyTrend} />
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-medium text-text">Campaigns</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Campaigns sent" value={String(data.campaigns.campaignCount)} />
              <StatCard label="Total recipients" value={String(data.campaigns.totalRecipients)} />
              <StatCard label="Delivered" value={String(data.campaigns.totalSent)} />
              <StatCard label="Failed" value={String(data.campaigns.totalFailed)} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-text">Reminders</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Pending" value={String(data.reminders.PENDING)} />
              <StatCard label="Sent" value={String(data.reminders.SENT)} />
              <StatCard label="Failed" value={String(data.reminders.FAILED)} />
              <StatCard label="Cancelled" value={String(data.reminders.CANCELLED)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
