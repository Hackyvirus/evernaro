"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";

interface RateCard {
  id: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
  countryCode: string;
  costPaise: number;
  updatedAt: string;
}

const CATEGORY_LABEL: Record<RateCard["category"], string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
  SERVICE: "Service (free-text, 24h window)",
};

export default function RateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    fetch("/api/platform/rate-cards")
      .then((r) => r.json())
      .then((d) => {
        const cards: RateCard[] = d.rateCards ?? [];
        setRateCards(cards);
        setDrafts(Object.fromEntries(cards.map((c) => [c.id, (c.costPaise / 100).toFixed(2)])));
      })
      .finally(() => setLoaded(true));
  }

  useEffect(refresh, []);

  async function save(card: RateCard) {
    setMessage(null);
    const costInr = Number(drafts[card.id]);
    if (!Number.isFinite(costInr) || costInr < 0) {
      setMessage("Enter a valid non-negative cost");
      return;
    }
    setSavingId(card.id);
    try {
      const res = await fetch("/api/platform/rate-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: card.category,
          countryCode: card.countryCode,
          costPaise: Math.round(costInr * 100),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Failed to save");
      } else {
        setMessage(`${CATEGORY_LABEL[card.category]} rate updated`);
        refresh();
      }
    } catch {
      setMessage("Network error — check your connection and try again.");
    }
    setSavingId(null);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">WhatsApp rate card</h1>
        <p className="text-sm text-text-secondary">
          Per-message cost the wallet debits, by Meta conversation category. These are placeholder
          estimates until verified against your actual Gupshup account billing.
        </p>
      </header>

      <div className="p-6">
        {!loaded ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : (
          <>
            {message && <p className="mb-4 text-sm text-text-secondary">{message}</p>}
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-text-secondary">
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Category</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Country</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Cost (₹)</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Updated</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rateCards.map((card) => (
                    <tr key={card.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5 text-text">{CATEGORY_LABEL[card.category]}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{card.countryCode}</td>
                      <td className="px-3 py-2.5">
                        <Input
                          className="w-24"
                          value={drafts[card.id] ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [card.id]: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {new Date(card.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button size="sm" variant="secondary" loading={savingId === card.id} onClick={() => save(card)}>
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
