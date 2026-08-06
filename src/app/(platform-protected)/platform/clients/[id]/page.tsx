import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SkeletonCard, SkeletonTable } from "@/components/ui";
import { getPlatformOrganization, getPlatformWallet } from "@/lib/platform-data";
import { ClientDetail } from "./client-detail";
import { refreshClients } from "../../actions";

// Queries platform data, so it must be rendered dynamically.
export const dynamic = "force-dynamic";

async function ClientContent({ id }: { id: string }) {
  const [org, walletData] = await Promise.all([getPlatformOrganization(id), getPlatformWallet(id)]);
  if (!org) notFound();

  return (
    <ClientDetail
      org={org}
      initialWallet={walletData.wallet}
      initialWalletTx={walletData.transactions}
      onRefresh={refreshClients}
    />
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="mt-6">
            <SkeletonTable />
          </div>
        </div>
      }
    >
      <ClientContent id={id} />
    </Suspense>
  );
}
