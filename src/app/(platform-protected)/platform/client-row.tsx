"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  monthlyFeeInr: number | null;
  owner: { name: string; email: string } | null;
  channels: Array<{ type: string; isActive: boolean }>;
  contactCount: number;
  conversationCount: number;
  lastActivityAt: string | null;
}

export function ClientRow({ org, onUpdated }: { org: OrgSummary; onUpdated: () => void }) {
  const [fee, setFee] = useState(org.monthlyFeeInr?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);

  async function saveFee() {
    setSaving(true);
    setFeeError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFeeInr: fee === "" ? null : Number(fee) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save fee");
      onUpdated();
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : "Failed to save fee");
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
        <Link href={`/platform/clients/${org.id}`} className="cursor-pointer font-medium hover:text-primary">
          {org.name}
        </Link>
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
        <div className="flex flex-col gap-1">
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
          {feeError && <p className="max-w-[160px] text-xs text-danger">{feeError}</p>}
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
