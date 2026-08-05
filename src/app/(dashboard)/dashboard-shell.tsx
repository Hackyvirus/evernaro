"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Cable,
  HelpCircle,
  Megaphone,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { NavItem, ThemeToggle, useSidebarCollapsed, IconButton } from "@/components/ui";
import { SignOutButton } from "./sign-out-button";

type NavItemDef = {
  href: string;
  icon: LucideIcon;
  label: string;
  roles?: string[];
};

const MAIN_NAV: NavItemDef[] = [
  { href: "/dashboard", icon: Briefcase, label: "Overview" },
  { href: "/inbox", icon: MessageSquare, label: "Inbox" },
  { href: "/contacts", icon: Users, label: "Contacts" },
  { href: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { href: "/reminders", icon: Bell, label: "Reminders" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
];

const CONFIG_NAV: NavItemDef[] = [
  { href: "/channels", icon: Cable, label: "Channels" },
  { href: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { href: "/team", icon: Users, label: "Team", roles: ["ADMIN", "OWNER"] },
];

const BOTTOM_NAV: NavItemDef[] = [
  { href: "/billing", icon: Receipt, label: "Billing", roles: ["ADMIN", "OWNER"] },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function SidebarContent({
  orgName,
  userName,
  userEmail,
  role,
  collapsed = false,
  onToggleCollapse,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  role: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {!collapsed && (
          <div>
            <p className="text-base font-extrabold tracking-tight text-primary">EverReach</p>
            <p className="text-xs text-text-secondary">{orgName}</p>
          </div>
        )}
        {collapsed && <span className="sr-only">EverReach</span>}
        {onToggleCollapse && (
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            className="flex-shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </IconButton>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {MAIN_NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wide text-text-muted uppercase">Configuration</p>
          )}
          {CONFIG_NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold tracking-wide text-text-muted uppercase">Account</p>
          )}
          {BOTTOM_NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className={`flex flex-col gap-3 border-t border-border pt-3 ${collapsed ? "items-center gap-2" : "gap-2"}`}>
        {!collapsed && (
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-text truncate">{userName || userEmail}</p>
            <p className="text-[10px] text-text-muted capitalize">{role.toLowerCase()}</p>
          </div>
        )}
        <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "w-full justify-between"}`}>
          <Link
            href="/help"
            className={`flex items-center gap-2 rounded-md py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text ${collapsed ? "justify-center px-0" : "px-3"}`}
          >
            <HelpCircle className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
            {!collapsed && <span>Help</span>}
          </Link>
          <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "gap-2"}`}>
            <SignOutButton collapsed={collapsed} />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}

export function DashboardShell({
  orgName,
  userName,
  userEmail,
  role,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  role: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <IconButton label="Open navigation menu" onClick={() => setMobileOpen(true)}>
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </IconButton>
        <p className="text-base font-extrabold tracking-tight text-primary">EverReach</p>
        <ThemeToggle />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-card p-4 shadow-[var(--shadow-elevated)]">
            <SidebarContent orgName={orgName} userName={userName} userEmail={userEmail} role={role} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden flex-col border-r border-border bg-card p-4 transition-[width] duration-150 md:flex ${
          collapsed ? "w-[68px] items-center" : "w-56"
        }`}
      >
        <SidebarContent
          orgName={orgName}
          userName={userName}
          userEmail={userEmail}
          role={role}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
