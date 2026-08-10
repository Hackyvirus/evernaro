"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { HELP_CATEGORIES } from "@/lib/help-data";

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return HELP_CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
    ).slice(0, 6);
  }, [query]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for help, e.g. connect WhatsApp"
          className="h-12 w-full rounded-lg border border-border bg-card pl-11 pr-4 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
      </div>
      {results.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-elevated)]">
          <ul>
            {results.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/help/${category.id}`)}
                  className="flex w-full flex-col items-start gap-1 px-4 py-3 text-start text-sm hover:bg-hover"
                >
                  <span className="font-medium text-text">{category.title}</span>
                  <span className="text-xs text-text-secondary sm:text-sm">{category.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
