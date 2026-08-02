"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui";

interface PlatformAnalytics {
  totalClients: number;
  activeClientCount: number;
  messagesSent: number;
  messagesReceived: number;
  nearCapClients: Array<{ orgId: string; orgName: string; used: number; limit: number }>;
}

export default function PlatformAnalyticsPage() {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/platform/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">Platform health</h1>
        <p className="text-sm text-text-secondary">How the whole fleet of clients is doing — last 30 days.</p>
      </header>

      {!loaded ? (
        <p className="p-6 text-sm text-text-secondary">Loading...</p>
      ) : !data ? (
        <p className="p-6 text-sm text-danger">Failed to load.</p>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total clients" value={String(data.totalClients)} />
            <StatCard label="Active (7 days)" value={String(data.activeClientCount)} />
            <StatCard label="Messages sent" value={String(data.messagesSent)} />
            <StatCard label="Messages received" value={String(data.messagesReceived)} />
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold text-text">Approaching daily campaign limit</h2>
            <p className="text-xs text-text-secondary">
              Clients at 80%+ of their per-org daily campaign recipient cap — worth a heads-up before
              they hit it.
            </p>
            {data.nearCapClients.length === 0 ? (
              <p className="text-sm text-text-muted">No one&apos;s close to the limit right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.nearCapClients.map((c) => (
                  <li key={c.orgId}>
                    <Link
                      href={`/platform/clients/${c.orgId}`}
                      className="flex cursor-pointer items-center justify-between rounded-md bg-surface px-3 py-2 hover:bg-hover"
                    >
                      <span className="text-sm text-text">{c.orgName}</span>
                      <span className="text-xs text-text-secondary">
                        {c.used} / {c.limit} today
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
