import { Suspense } from "react";
import Link from "next/link";
import { Card, SkeletonCard, StatCard, Badge } from "@/components/ui";
import { getPlatformAnalytics } from "@/lib/platform-data";
import { ArrowUpRight, TrendingUp, Users, CreditCard } from "lucide-react";

function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

async function AnalyticsContent() {
  const data = await getPlatformAnalytics();

  return (
    <div className="flex flex-col gap-6">
      {/* Core product metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total clients" value={String(data.totalClients)} />
        <StatCard label="Active (7 days)" value={String(data.activeClientCount)} />
        <StatCard label="Messages sent" value={String(data.messagesSent)} />
        <StatCard label="Messages received" value={String(data.messagesReceived)} />
      </div>

      {/* Revenue & subscription metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">MRR</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text">{formatInr(data.revenue.mrrInr)}</p>
          <p className="text-xs text-text-secondary">Monthly recurring revenue</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">ARR</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text">{formatInr(data.revenue.arrInr)}</p>
          <p className="text-xs text-text-secondary">Annual run rate</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">Revenue this month</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text">{formatInr(data.revenue.thisMonthInr)}</p>
          <p className="text-xs text-text-secondary">Paid invoices</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">Total revenue</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-text">{formatInr(data.revenue.totalPaidInr)}</p>
          <p className="text-xs text-text-secondary">Lifetime paid</p>
        </Card>
      </div>

      {/* Subscription status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text">Subscriptions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-success-light p-3 text-center">
              <p className="text-xl font-bold text-success">{data.subscriptions.active}</p>
              <p className="text-xs text-text-secondary">Active</p>
            </div>
            <div className="rounded-lg bg-primary-lighter p-3 text-center">
              <p className="text-xl font-bold text-primary">{data.subscriptions.trialing}</p>
              <p className="text-xs text-text-secondary">Trialing</p>
            </div>
            <div className="rounded-lg bg-warning-light p-3 text-center">
              <p className="text-xl font-bold text-warning">{data.subscriptions.pastDue}</p>
              <p className="text-xs text-text-secondary">Past due</p>
            </div>
            <div className="rounded-lg bg-surface p-3 text-center">
              <p className="text-xl font-bold text-text">{data.subscriptions.paused}</p>
              <p className="text-xs text-text-secondary">Paused</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-4 text-sm font-semibold text-text">MRR by plan</h2>
          {data.revenue.byPlan.length === 0 ? (
            <p className="text-sm text-text-muted">No active subscriptions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.revenue.byPlan.map((p) => (
                <li key={p.planId} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{p.planName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">{p.activeSubscriptions} active</span>
                    <span className="font-medium text-text">{formatInr(p.mrrInr)}/mo</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent subscriptions */}
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-text">Recent subscriptions</h2>
        {data.subscriptions.recent.length === 0 ? (
          <p className="text-sm text-text-muted">No subscriptions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.subscriptions.recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/platform/clients/${s.orgId}`}
                  className="flex cursor-pointer items-center justify-between rounded-md bg-surface px-3 py-2 hover:bg-hover"
                >
                  <div>
                    <p className="text-sm text-text">{s.orgName}</p>
                    <p className="text-xs text-text-secondary">
                      {s.planName} · {s.frequency.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        s.status === "ACTIVE"
                          ? "success"
                          : s.status === "TRIALING"
                            ? "primary"
                            : s.status === "PAST_DUE"
                              ? "warning"
                              : "default"
                      }
                    >
                      {s.status}
                    </Badge>
                    <span className="text-sm font-medium text-text">{formatInr(s.totalAmountInr)}</span>
                    <ArrowUpRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Campaign cap clients */}
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
  );
}

export default function PlatformAnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <h1 className="text-xl font-bold text-text">Platform health</h1>
        <p className="text-sm text-text-secondary">How the whole fleet of clients is doing — last 30 days.</p>
      </header>

      <div className="p-6">
        <Suspense fallback={<SkeletonCard />}>
          <AnalyticsContent />
        </Suspense>
      </div>
    </div>
  );
}
