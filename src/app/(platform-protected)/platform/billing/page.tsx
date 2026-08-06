import { Suspense } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Badge, EmptyState, SkeletonCard, SkeletonTable, StatCard } from "@/components/ui";
import { getPlatformInvoices } from "@/lib/platform-data";

function statusVariant(status: "PENDING" | "PAID" | "FAILED" | "CANCELLED"): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "warning";
}

async function BillingContent() {
  const { invoices, summary } = await getPlatformInvoices();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={`₹${summary.totalPaidInr.toLocaleString("en-IN")}`} />
        <StatCard label="Pending" value={`₹${summary.totalPendingInr.toLocaleString("en-IN")}`} />
        <StatCard label="Overdue (7+ days)" value={String(summary.overdueCount)} />
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Generate one from a client's page." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-start text-sm">
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
  );
}

export default function PlatformBillingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <h1 className="text-xl font-bold text-text">Billing</h1>
        <p className="text-sm text-text-secondary">Every invoice across every client.</p>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <Suspense
          fallback={
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <SkeletonTable />
            </>
          }
        >
          <BillingContent />
        </Suspense>
      </div>
    </div>
  );
}
