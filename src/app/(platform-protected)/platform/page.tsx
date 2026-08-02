"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge, Button, EmptyState, StatCard } from "@/components/ui";

interface OrgChannel {
  type: string;
  isActive: boolean;
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  monthlyFeeInr: number | null;
  owner: { name: string; email: string } | null;
  channels: OrgChannel[];
  contactCount: number;
  conversationCount: number;
  lastActivityAt: string | null;
}

export default function PlatformClientsPage() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    fetch("/api/platform/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const mrr = orgs.reduce((sum, o) => sum + (o.monthlyFeeInr ?? 0), 0);
  const activeChannelCount = orgs.reduce(
    (sum, o) => sum + o.channels.filter((c) => c.isActive).length,
    0
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">Clients</h1>
        <p className="text-sm text-text-secondary">Every organization on EverReach.</p>
      </header>

      <div className="grid grid-cols-3 gap-4 border-b border-border px-6 py-4">
        <StatCard label="Clients" value={String(orgs.length)} />
        <StatCard label="MRR (manual)" value={`₹${mrr.toLocaleString("en-IN")}`} />
        <StatCard label="Active channel connections" value={String(activeChannelCount)} />
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : orgs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            action={
              <Link href="/platform/clients/new" className="cursor-pointer text-sm text-primary hover:text-primary-hover">
                Add one
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-text-secondary">
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Client</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Owner</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Channels</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Contacts</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Conversations</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Last activity</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Monthly fee</th>
                  <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Billing</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <ClientRow key={org.id} org={org} onUpdated={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({ org, onUpdated }: { org: OrgSummary; onUpdated: () => void }) {
  const [fee, setFee] = useState(org.monthlyFeeInr?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);

  async function saveFee() {
    setSaving(true);
    try {
      await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFeeInr: fee === "" ? null : Number(fee) }),
      });
      onUpdated();
    } catch {
      // best-effort — the field just won't update; no destructive state to unwind
    } finally {
      setSaving(false);
    }
  }

  async function generateInvoice() {
    setInvoicing(true);
    setInvoiceMessage(null);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}/invoices`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceMessage(data.error ?? "Failed to create invoice");
      } else if (data.warning) {
        setInvoiceMessage(data.warning);
      } else {
        setInvoiceMessage("Invoice created");
      }
    } catch {
      setInvoiceMessage("Network error — check your connection and try again.");
    }
    setInvoicing(false);
  }

  return (
    <tr className="border-b border-border last:border-b-0 transition-colors hover:bg-hover">
      <td className="px-3 py-2.5 text-text">
        {org.name}
        <p className="text-xs text-text-muted">
          Since {new Date(org.createdAt).toLocaleDateString()}
        </p>
      </td>
      <td className="px-3 py-2.5 text-text-secondary">
        {org.owner ? (
          <>
            {org.owner.name}
            <p className="text-xs text-text-muted">{org.owner.email}</p>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5">
        {org.channels.length === 0 ? (
          <span className="text-text-muted">none connected</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {org.channels.map((c) => (
              <Badge key={c.type} variant={c.isActive ? "success" : "default"}>
                {c.type}
              </Badge>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-text-secondary">{org.contactCount}</td>
      <td className="px-3 py-2.5 text-text-secondary">{org.conversationCount}</td>
      <td className="px-3 py-2.5 text-text-secondary">
        {org.lastActivityAt ? new Date(org.lastActivityAt).toLocaleString() : "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-text-muted">₹</span>
          <input
            className="h-8 w-20 rounded-md border border-border bg-card px-2 text-xs text-text outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={saveFee}
            disabled={saving}
            placeholder="0"
          />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col items-start gap-1">
          <Button size="sm" variant="secondary" loading={invoicing} onClick={generateInvoice}>
            Generate invoice
          </Button>
          {invoiceMessage && <p className="max-w-[220px] text-xs text-text-muted">{invoiceMessage}</p>}
        </div>
      </td>
    </tr>
  );
}
