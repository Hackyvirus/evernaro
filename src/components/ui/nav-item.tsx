"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function NavItem({
  href,
  icon: Icon,
  label,
  exact = false,
  collapsed = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={`group relative flex cursor-pointer items-center gap-2.5 rounded-md py-2 text-sm transition-colors ${
        collapsed ? "justify-center px-0" : "px-3"
      } ${
        isActive
          ? "bg-primary-lighter font-medium text-primary"
          : "text-text-secondary hover:bg-hover hover:text-text"
      }`}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
      {!collapsed && label}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-border bg-card-elevated px-2 py-1 text-xs font-medium text-text opacity-0 shadow-[var(--shadow-elevated)] transition-opacity group-hover:opacity-100"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
