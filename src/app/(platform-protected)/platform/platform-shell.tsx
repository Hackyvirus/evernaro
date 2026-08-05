"use client";

import { useState } from "react";
import { BarChart3, Building2, Menu, PanelLeftClose, PanelLeftOpen, Receipt, Shield, UserPlus, Wallet } from "lucide-react";
import { NavItem, ThemeToggle, useSidebarCollapsed } from "@/components/ui";
import { PlatformSignOutButton } from "./sign-out-button";

const NAV_ITEMS = [
  { href: "/platform", icon: Building2, label: "Clients", exact: true },
  { href: "/platform/clients/new", icon: UserPlus, label: "Add client" },
  { href: "/platform/billing", icon: Receipt, label: "Billing" },
  { href: "/platform/rate-cards", icon: Wallet, label: "WhatsApp rates" },
  { href: "/platform/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/platform/audit-logs", icon: Shield, label: "Audit logs" },
];

function SidebarContent({
  adminName,
  collapsed = false,
  onToggleCollapse,
}: {
  adminName: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {!collapsed && (
          <div>
            <p className="text-base font-extrabold tracking-tight text-primary">EverReach</p>
            <p className="text-xs text-text-secondary">Platform · {adminName}</p>
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>
      <div className={`flex items-center pt-2 ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
        <PlatformSignOutButton collapsed={collapsed} />
        <ThemeToggle />
      </div>
    </>
  );
}

export function PlatformShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:flex-row">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-text"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <p className="text-base font-extrabold tracking-tight text-primary">EverReach</p>
        <ThemeToggle />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-card p-4 shadow-[var(--shadow-elevated)]">
            <SidebarContent adminName={adminName} />
          </aside>
        </div>
      )}

      <aside
        className={`hidden flex-col border-r border-border bg-card p-4 transition-[width] duration-150 md:flex ${
          collapsed ? "w-[68px] items-center" : "w-56"
        }`}
      >
        <SidebarContent
          adminName={adminName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
