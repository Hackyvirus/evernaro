"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HELP_CATEGORIES } from "@/lib/help-data";

export function HelpNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Help categories" className="flex flex-col gap-1">
      <Link
        href="/help"
        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          pathname === "/help"
            ? "bg-primary-lighter text-primary"
            : "text-text-secondary hover:bg-hover hover:text-text"
        }`}
      >
        Help Center
      </Link>
      {HELP_CATEGORIES.map((category) => {
        const isActive = pathname === `/help/${category.id}`;
        return (
          <Link
            key={category.id}
            href={`/help/${category.id}`}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-primary-lighter font-medium text-primary"
                : "text-text-secondary hover:bg-hover hover:text-text"
            }`}
          >
            {category.title}
          </Link>
        );
      })}
    </nav>
  );
}
