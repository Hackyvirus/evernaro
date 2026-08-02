"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Badge, EmptyState, StatCard } from "@/components/ui";

interface PlatformInvoice {
  id: string;
  orgId: string;
  orgName: string;
  amountInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
}

interface Summary {
  totalPaidInr: number;
  totalPendingInr: number;
  overdueCount: number;
}

function statusVariant(status: PlatformInvoice["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "warning";
}

export default function PlatformBillingPage() {
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/platform/invoices")
      .then((r) => r.json())
      .then((d) => {
        setInvoices(d.invoices ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">Billing</h1>
        <p className="text-sm text-text-secondary">Every invoice across every client.</p>
      </header>

      {!loaded ? (
        <p className="p-6 text-sm text-text-secondary">Loading...</p>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Collected" value={`₹${(summary?.totalPaidInr ?? 0).toLocaleString("en-IN")}`} />
            <StatCard label="Pending" value={`₹${(summary?.totalPendingInr ?? 0).toLocaleString("en-IN")}`} />
            <StatCard label="Overdue (7+ days)" value={String(summary?.overdueCount ?? 0)} />
          </div>

          {invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices yet" description="Generate one from a client's page." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-text-secondary">
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Client</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Amount</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Status</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Created</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-hover">
                      <td className="px-3 py-2.5">
                        <Link href={`/platform/clients/${inv.orgId}`} className="cursor-pointer text-text hover:text-primary">
                          {inv.orgName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-text">₹{inv.amountInr.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
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
        </div>
      )}
    </div>
  );
}
