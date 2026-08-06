import { Suspense } from "react";
import { SkeletonTable } from "@/components/ui";
import { getPlatformRateCards } from "@/lib/platform-data";
import { RateCardTable } from "./rate-card-table";
import { refreshClients } from "../actions";

async function RateCardsContent() {
  const rateCards = await getPlatformRateCards();
  return <RateCardTable initialCards={rateCards} onRefresh={refreshClients} />;
}

export default function RateCardsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <h1 className="text-xl font-bold text-text">WhatsApp rate card</h1>
        <p className="text-sm text-text-secondary">
          Per-message cost the wallet debits, by Meta conversation category. Update these values to
          match your Gupshup account billing.
        </p>
      </header>

      <div className="p-6">
        <Suspense fallback={<SkeletonTable />}>
          <RateCardsContent />
        </Suspense>
      </div>
    </div>
  );
}
