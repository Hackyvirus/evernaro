"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, Input, StatCard } from "@/components/ui";

interface Channel {
  id: string;
  type: string;
  isActive: boolean;
  telegramBotUsername: string | null;
  emailAddress: string | null;
  whatsappAppName: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
  twilioFromNumber: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  amountInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  monthlyFeeInr: number | null;
  industry: string | null;
  description: string | null;
  users: Array<{ id: string; name: string; email: string; role: string; createdAt: string }>;
  channels: Channel[];
  invoices: Invoice[];
  contactCount: number;
  conversationCount: number;
  campaignCount: number;
  reminderCount: number;
  lastActivityAt: string | null;
}

function channelDetail(c: Channel): string {
  if (c.type === "TELEGRAM") return c.telegramBotUsername ? `@${c.telegramBotUsername}` : "—";
  if (c.type === "EMAIL") return c.emailAddress ?? "—";
  if (c.type === "WHATSAPP") return c.whatsappSourceNumber ? `${c.whatsappAppName} · ${c.whatsappSourceNumber}` : "—";
  if (c.type === "INSTAGRAM") return c.instagramUsername ? `@${c.instagramUsername}` : "—";
  if (c.type === "VOICE") return c.twilioFromNumber ?? "—";
  return "—";
}

function invoiceStatusVariant(status: Invoice["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "warning";
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fee, setFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);

  function refresh() {
    fetch(`/api/platform/organizations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.organization) {
          setOrg(d.organization);
          setFee(d.organization.monthlyFeeInr?.toString() ?? "");
        }
      })
      .finally(() => setLoaded(true));
  }

  useEffect(refresh, [id]);

  async function saveFee() {
    setSavingFee(true);
    try {
      await fetch(`/api/platform/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFeeInr: fee === "" ? null : Number(fee) }),
      });
      refresh();
    } catch {
      // best-effort
    } finally {
      setSavingFee(false);
    }
  }

  async function generateInvoice() {
    setInvoicing(true);
    setInvoiceMessage(null);
    try {
      const res = await fetch(`/api/platform/organizations/${id}/invoices`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceMessage(data.error ?? "Failed to create invoice");
      } else if (data.warning) {
        setInvoiceMessage(data.warning);
      } else {
        setInvoiceMessage("Invoice created");
      }
      refresh();
    } catch {
      setInvoiceMessage("Network error — check your connection and try again.");
    }
    setInvoicing(false);
  }

  if (!loaded) {
    return <p className="p-6 text-sm text-text-secondary">Loading...</p>;
  }
  if (!org) {
    return <p className="p-6 text-sm text-danger">Client not found.</p>;
  }

  const owner = org.users.find((u) => u.role === "OWNER") ?? org.users[0];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <Link href="/platform" className="mb-2 flex w-fit items-center gap-1.5 text-xs text-text-secondary hover:text-text">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to clients
        </Link>
        <h1 className="text-xl font-bold text-text">{org.name}</h1>
        <p className="text-sm text-text-secondary">
          {org.slug} · Since {new Date(org.createdAt).toLocaleDateString()}
          {org.industry ? ` · ${org.industry}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Contacts" value={String(org.contactCount)} />
          <StatCard label="Conversations" value={String(org.conversationCount)} />
          <StatCard label="Campaigns" value={String(org.campaignCount)} />
          <StatCard label="Reminders" value={String(org.reminderCount)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold text-text">Owner</h2>
            {owner ? (
              <div className="text-sm">
                <p className="text-text">{owner.name}</p>
                <p className="text-text-secondary">{owner.email}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {owner.role} · Joined {new Date(owner.createdAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No owner on file.</p>
            )}
            {org.description && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-text-secondary">Business description</p>
                <p className="mt-1 text-sm text-text-secondary">{org.description}</p>
              </div>
            )}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-secondary">
                Last activity:{" "}
                {org.lastActivityAt ? new Date(org.lastActivityAt).toLocaleString() : "No activity yet"}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold text-text">Channels</h2>
            {org.channels.length === 0 ? (
              <p className="text-sm text-text-muted">No channels connected yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {org.channels.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-text">{c.type}</p>
                      <p className="text-xs text-text-secondary">{channelDetail(c)}</p>
                    </div>
                    <Badge variant={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-semibold text-text">Billing</h2>
            <div className="flex items-end gap-2">
              <Input
                label="Monthly fee (₹)"
                className="w-32"
                value={fee}
                onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={saveFee}
                disabled={savingFee}
                placeholder="0"
              />
              <Button size="sm" variant="secondary" loading={invoicing} onClick={generateInvoice}>
                Generate invoice
              </Button>
            </div>
          </div>
          {invoiceMessage && <p className="text-xs text-text-muted">{invoiceMessage}</p>}

          {org.invoices.length === 0 ? (
            <p className="text-sm text-text-muted">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-text-secondary">
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Amount</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Status</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Created</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {org.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5 text-text">₹{inv.amountInr.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
