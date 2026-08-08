"use client";

import { useState } from "react";
import { Button, Card, Input, Badge } from "@/components/ui";
import {
  Layers,
  Package,
  Tag,
  Percent,
  ReceiptIndianRupee,
  LayoutDashboard,
  Users,
  Search,
  Eye,
  X,
} from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceInr: number;
  annualPriceInr: number;
  trialDays: number;
  isActive: boolean;
  isCustom: boolean;
  _count: { subscriptions: number };
  features: { key: string; label: string; value: string | null; included: boolean }[];
  limits: { includedQuantity: number; service: { key: string; name: string; unit: string } }[];
}

interface Service {
  id: string;
  key: string;
  name: string;
  category: string;
  unit: string;
  billingType: string;
  basePriceInr: number;
}

interface AddOn {
  id: string;
  slug: string;
  name: string;
  priceInr: number;
  frequency: string;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
}

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
}

interface TaxConfig {
  name: string;
  rate: number;
  inclusive: boolean;
}

interface Metrics {
  mrr: number;
  arr: number;
  revenueThisMonth: number;
  totalRevenue: number;
  totalCustomers: number;
  statusCounts: {
    active: number;
    trialing: number;
    pastDue: number;
    paymentFailed: number;
    cancelled: number;
    paused: number;
  };
  customersByPlan: { planId: string; planName: string; active: number; trialing: number }[];
}

interface SubscriptionRow {
  id: string;
  status: string;
  frequency: string;
  currentPeriodStart: string | Date | null;
  currentPeriodEnd: string | Date | null;
  trialEnd: string | Date | null;
  cancelledAt: string | Date | null;
  cancelAtPeriodEnd: boolean;
  razorpaySubscriptionId: string | null;
  razorpayCustomerId: string | null;
  baseAmountInr: number;
  discountAmountInr: number;
  taxAmountInr: number;
  totalAmountInr: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  org: { id: string; name: string; slug: string; status: string; users: { email: string; name: string }[] };
  plan: { id: string; name: string; slug: string; monthlyPriceInr: number; annualPriceInr: number };
  items: { addOn: { name: string } | null; quantity: number; totalPriceInr: number }[];
  invoices: { id: string; amountInr: number; status: string; createdAt: string | Date; paidAt: string | Date | null }[];
  payments: { id: string; amountInr: number; status: string; createdAt: string | Date; razorpayPaymentId: string | null }[];
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscriptions", label: "Subscriptions", icon: Users },
  { id: "plans", label: "Plans", icon: Layers },
  { id: "services", label: "Services", icon: Package },
  { id: "addOns", label: "Add-ons", icon: Tag },
  { id: "coupons", label: "Coupons", icon: Percent },
  { id: "tax", label: "Tax", icon: ReceiptIndianRupee },
];

interface Props {
  plans: Plan[];
  services: Service[];
  addOns: AddOn[];
  coupons: Coupon[];
  tax: TaxConfig | null;
  metrics: Metrics;
  initialSubscriptions: SubscriptionRow[];
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "active" || s === "paid") return "success";
  if (s === "trialing") return "info";
  if (s === "past_due" || s === "pending") return "warning";
  if (s === "cancelled" || s === "failed" || s === "payment_failed") return "danger";
  return "default";
}

export function BillingCatalogTabs({ plans, services, addOns, coupons, tax, metrics, initialSubscriptions }: Props) {
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionRow | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>(initialSubscriptions);

  async function saveTax(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/platform/billing/tax", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        rate: Number(form.get("rate")),
        inclusive: form.get("inclusive") === "on",
      }),
    });
    setSaving(false);
  }

  async function searchSubscriptions(q: string) {
    setSearch(q);
    const res = await fetch(`/api/platform/billing/subscriptions?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.subscriptions) setSubscriptions(data.subscriptions);
  }

  const filteredSubscriptions = subscriptions.filter(
    (s) =>
      s.org.name.toLowerCase().includes(search.toLowerCase()) ||
      s.org.slug.toLowerCase().includes(search.toLowerCase()) ||
      (s.razorpaySubscriptionId ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border">
        <nav aria-label="Tabs" className="flex gap-6 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs text-text-secondary">MRR</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{formatCurrency(metrics.mrr)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">ARR</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{formatCurrency(metrics.arr)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Revenue this month</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{formatCurrency(metrics.revenueThisMonth)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Total revenue</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{formatCurrency(metrics.totalRevenue)}</p>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Active subscriptions</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.active}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Trialing</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.trialing}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Past due</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.pastDue}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Failed payments</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.paymentFailed}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Cancelled</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.cancelled}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-text-secondary">Paused</p>
              <p className="mt-1 text-2xl font-extrabold text-text">{metrics.statusCounts.paused}</p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold text-text">Customers by plan</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.customersByPlan.map((p) => (
                <div key={p.planId} className="rounded-lg bg-surface-secondary p-4">
                  <p className="text-sm font-semibold text-text">{p.planName}</p>
                  <div className="mt-2 flex gap-4 text-sm text-text-secondary">
                    <span>Active: {p.active}</span>
                    <span>Trialing: {p.trialing}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
            <Input
              placeholder="Search by client, slug, or Razorpay subscription ID"
              value={search}
              onChange={(e) => searchSubscriptions(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-start text-xs uppercase">Client</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Plan</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Status</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Interval</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Amount</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Started</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Next billing</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Razorpay sub</th>
                  <th className="px-3 py-2 text-start text-xs uppercase">Last payment</th>
                  <th className="px-3 py-2 text-start text-xs uppercase" />
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((s) => {
                  const lastPayment = s.payments[0];
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <p className="font-medium text-text">{s.org.name}</p>
                        <p className="text-xs text-text-muted">{s.org.slug}</p>
                      </td>
                      <td className="px-3 py-2">{s.plan.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-2 capitalize">{s.frequency.toLowerCase()}</td>
                      <td className="px-3 py-2">{formatCurrency(s.totalAmountInr)}</td>
                      <td className="px-3 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{s.razorpaySubscriptionId ?? "—"}</td>
                      <td className="px-3 py-2">
                        {lastPayment ? (
                          <span className="text-success">{formatCurrency(lastPayment.amountInr)}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedSubscription(s)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-sm text-text-secondary">
                      No subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedSubscription && (
            <Card className="relative p-5">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3"
                onClick={() => setSelectedSubscription(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <h3 className="mb-4 text-base font-bold text-text">Subscription details</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-text-secondary">Organization</p>
                  <p className="text-sm font-medium text-text">{selectedSubscription.org.name}</p>
                  <p className="text-xs text-text-muted">{selectedSubscription.org.slug}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Owner</p>
                  <p className="text-sm font-medium text-text">{selectedSubscription.org.users?.[0]?.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Current plan</p>
                  <p className="text-sm font-medium text-text">{selectedSubscription.plan.name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Status</p>
                  <Badge variant={statusVariant(selectedSubscription.status)}>{selectedSubscription.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Billing interval</p>
                  <p className="text-sm font-medium text-text capitalize">{selectedSubscription.frequency.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Amount</p>
                  <p className="text-sm font-medium text-text">{formatCurrency(selectedSubscription.totalAmountInr)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Start date</p>
                  <p className="text-sm font-medium text-text">{new Date(selectedSubscription.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Trial end</p>
                  <p className="text-sm font-medium text-text">
                    {selectedSubscription.trialEnd ? new Date(selectedSubscription.trialEnd).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Next billing date</p>
                  <p className="text-sm font-medium text-text">
                    {selectedSubscription.currentPeriodEnd ? new Date(selectedSubscription.currentPeriodEnd).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Cancelled date</p>
                  <p className="text-sm font-medium text-text">
                    {selectedSubscription.cancelledAt ? new Date(selectedSubscription.cancelledAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Razorpay subscription ID</p>
                  <p className="text-sm font-medium text-text font-mono">{selectedSubscription.razorpaySubscriptionId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Razorpay customer ID</p>
                  <p className="text-sm font-medium text-text font-mono">{selectedSubscription.razorpayCustomerId ?? "—"}</p>
                </div>
              </div>

              {selectedSubscription.items.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Add-ons</p>
                  <ul className="flex flex-col gap-1">
                    {selectedSubscription.items.map((item, i) => (
                      <li key={i} className="text-sm text-text-secondary">
                        {item.addOn?.name ?? "Add-on"} x{item.quantity} — {formatCurrency(item.totalPriceInr)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Payment history</p>
                  {selectedSubscription.payments.length === 0 ? (
                    <p className="text-sm text-text-secondary">No payments recorded.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {selectedSubscription.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2 text-sm">
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                          <span className="font-medium">{formatCurrency(p.amountInr)}</span>
                          <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Recent invoices</p>
                  {selectedSubscription.invoices.length === 0 ? (
                    <p className="text-sm text-text-secondary">No invoices found.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {selectedSubscription.invoices.map((inv) => (
                        <li key={inv.id} className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2 text-sm">
                          <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                          <span className="font-medium">{formatCurrency(inv.amountInr)}</span>
                          <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "plans" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-text">{plan.name}</h3>
                  <p className="text-xs text-text-secondary">{plan.slug}</p>
                </div>
                <Badge variant={plan.isActive ? "success" : "default"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{plan.description}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span>₹{plan.monthlyPriceInr.toLocaleString("en-IN")}/mo</span>
                <span>₹{plan.annualPriceInr.toLocaleString("en-IN")}/yr</span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{plan._count.subscriptions} active subscriptions</p>
              {plan.features.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {plan.features.filter((f) => f.included).map((f) => (
                    <li key={f.key} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                      {f.label}
                    </li>
                  ))}
                </ul>
              )}
              {plan.limits.length > 0 && (
                <div className="mt-3 text-xs text-text-muted">
                  Limits: {plan.limits.map((l) => `${l.includedQuantity} ${l.service.unit}`).join(", ")}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "services" && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-start text-xs uppercase">Key</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Name</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Category</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Unit</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Type</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Base price</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{svc.key}</td>
                  <td className="px-3 py-2">{svc.name}</td>
                  <td className="px-3 py-2">{svc.category}</td>
                  <td className="px-3 py-2">{svc.unit}</td>
                  <td className="px-3 py-2">{svc.billingType}</td>
                  <td className="px-3 py-2">₹{svc.basePriceInr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "addOns" && (
        <div className="grid gap-4 md:grid-cols-2">
          {addOns.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text">{a.name}</h3>
                <Badge variant={a.isActive ? "success" : "default"}>{a.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-sm text-text-secondary">{a.slug}</p>
              <p className="mt-2 text-sm">₹{a.priceInr.toLocaleString("en-IN")}/{a.frequency.toLowerCase()}</p>
              <p className="text-xs text-text-muted">Qty: {a.minQuantity}-{a.maxQuantity ?? "∞"}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "coupons" && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-start text-xs uppercase">Code</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Type</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Value</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Redemptions</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2">{c.type}</td>
                  <td className="px-3 py-2">{c.type === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}</td>
                  <td className="px-3 py-2">{c.redemptionCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-3 py-2"><Badge variant={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tax" && tax && (
        <Card className="max-w-md p-5">
          <form onSubmit={saveTax} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary">Tax name</label>
              <Input name="name" defaultValue={tax.name} required />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Rate (%)</label>
              <Input name="rate" type="number" step="0.01" defaultValue={tax.rate} required />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input name="inclusive" type="checkbox" defaultChecked={tax.inclusive} />
              Tax inclusive
            </label>
            <Button type="submit" loading={saving}>Save tax config</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
