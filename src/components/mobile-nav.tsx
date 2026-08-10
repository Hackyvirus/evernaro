"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui";

interface MobileNavItem {
  href: string;
  label: string;
}

interface MobileNavProps {
  items: MobileNavItem[];
  cta?: { href: string; label: string };
}

export function MobileNav({ items, cta }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-10 px-0"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </Button>

      {open && (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 top-[65px] z-40 border-b border-border bg-card/95 px-6 py-4 shadow-[var(--shadow-elevated)] backdrop-blur-md"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-text-secondary hover:bg-hover hover:text-text"
              >
                {item.label}
              </Link>
            ))}
            {cta && (
              <Link href={cta.href} onClick={() => setOpen(false)} className="mt-2">
                <Button className="w-full">{cta.label}</Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
