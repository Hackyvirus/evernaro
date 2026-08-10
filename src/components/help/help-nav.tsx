"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HELP_CATEGORIES } from "@/lib/help-data";

export function HelpNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCategory = HELP_CATEGORIES.find((c) => pathname === `/help/${c.id}`);

  return (
    <nav aria-label="Help categories">
      {/* Mobile category selector */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((s) => !s)}
          aria-expanded={mobileOpen}
          aria-controls="help-category-list"
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text"
        >
          <span>{activeCategory?.title || "Help Center"}</span>
          <ChevronDown
            className={`h-4 w-4 text-text-muted transition-transform ${mobileOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {mobileOpen && (
          <div id="help-category-list" className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)]">
            <CategoryLink href="/help" label="Help Center" isActive={pathname === "/help"} onClick={() => setMobileOpen(false)} />
            {HELP_CATEGORIES.map((category) => (
              <CategoryLink
                key={category.id}
                href={`/help/${category.id}`}
                label={category.title}
                isActive={pathname === `/help/${category.id}`}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop sidebar navigation */}
      <div className="hidden flex-col gap-1 lg:flex">
        <CategoryLink href="/help" label="Help Center" isActive={pathname === "/help"} />
        {HELP_CATEGORIES.map((category) => (
          <CategoryLink
            key={category.id}
            href={`/help/${category.id}`}
            label={category.title}
            isActive={pathname === `/help/${category.id}`}
          />
        ))}
      </div>
    </nav>
  );
}

function CategoryLink({
  href,
  label,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-primary-lighter font-medium text-primary"
          : "text-text-secondary hover:bg-hover hover:text-text"
      }`}
    >
      {label}
    </Link>
  );
}

