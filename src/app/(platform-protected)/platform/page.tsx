import { Suspense } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState, SkeletonTable, StatCard } from "@/components/ui";
import { getPlatformOrganizations } from "@/lib/platform-data";
import { ClientRow } from "./client-row";
import { refreshClients } from "./actions";

async function ClientsContent() {
  const { organizations: orgs } = await getPlatformOrganizations();

  const mrr = orgs.reduce((sum, o) => sum + (o.monthlyFeeInr ?? 0), 0);
  const activeChannelCount = orgs.reduce(
    (sum, o) => sum + o.channels.filter((c) => c.isActive).length,
    0
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-4 border-b border-border px-6 py-4">
        <StatCard label="Clients" value={String(orgs.length)} />
        <StatCard label="MRR (manual)" value={`₹${mrr.toLocaleString("en-IN")}`} />
        <StatCard label="Active channel connections" value={String(activeChannelCount)} />
      </div>

      <div className="px-6 py-4">
        {orgs.length === 0 ? (
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
            <table className="w-full text-start text-sm">
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
                  <ClientRow key={org.id} org={org} onUpdated={refreshClients} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function PlatformClientsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <h1 className="text-xl font-bold text-text">Clients</h1>
        <p className="text-sm text-text-secondary">Every organization on Evernaro.</p>
      </header>

      <Suspense fallback={<SkeletonTable />}>
        <ClientsContent />
      </Suspense>
    </div>
  );
}
