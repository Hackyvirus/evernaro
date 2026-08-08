import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Cable,
  Calendar,
  ClipboardList,
  Gift,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Receipt,
  Scissors,
  Settings,
  Star,
  Users,
  Wrench,
} from "lucide-react";

export type NavSection = "main" | "config" | "account";

export type NavItemDef = {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  roles?: string[];
  section: NavSection;
};

// Canonical nav key registry. Industry templates reference these keys.
const NAV_REGISTRY: NavItemDef[] = [
  { key: "overview", href: "/dashboard", icon: Briefcase, label: "Overview", section: "main" },
  { key: "inbox", href: "/inbox", icon: MessageSquare, label: "Inbox", section: "main" },
  { key: "contacts", href: "/contacts", icon: Users, label: "Contacts", section: "main" },
  { key: "customers", href: "/contacts", icon: Users, label: "Customers", section: "main" },
  { key: "leads", href: "/contacts", icon: Users, label: "Leads", section: "main" },
  { key: "patients", href: "/contacts", icon: Users, label: "Patients", section: "main" },
  { key: "students", href: "/contacts", icon: Users, label: "Students", section: "main" },
  { key: "clients", href: "/contacts", icon: Users, label: "Clients", section: "main" },
  { key: "campaigns", href: "/campaigns", icon: Megaphone, label: "Campaigns", section: "main" },
  { key: "reminders", href: "/reminders", icon: Bell, label: "Reminders", section: "main" },
  { key: "analytics", href: "/analytics", icon: BarChart3, label: "Analytics", section: "main" },

  // Operational modules
  { key: "queue", href: "/queue", icon: ClipboardList, label: "Queue", section: "main" },
  { key: "waitlist", href: "/queue", icon: ClipboardList, label: "Waitlist", section: "main" },
  { key: "appointments", href: "/appointments", icon: Calendar, label: "Appointments", section: "main" },
  { key: "siteVisits", href: "/appointments", icon: Calendar, label: "Site Visits", section: "main" },
  { key: "reservations", href: "/appointments", icon: Calendar, label: "Reservations", section: "main" },
  { key: "counselling", href: "/appointments", icon: Calendar, label: "Counselling", section: "main" },
  { key: "consultations", href: "/appointments", icon: Calendar, label: "Consultations", section: "main" },
  { key: "services", href: "/services", icon: Scissors, label: "Services", section: "main" },
  { key: "treatments", href: "/services", icon: Scissors, label: "Treatments", section: "main" },
  { key: "courses", href: "/services", icon: BookOpen, label: "Courses", section: "main" },
  { key: "staff", href: "/staff", icon: Users, label: "Staff", section: "main" },
  { key: "stylists", href: "/staff", icon: Users, label: "Stylists", section: "main" },
  { key: "doctors", href: "/staff", icon: Users, label: "Doctors", section: "main" },
  { key: "dentists", href: "/staff", icon: Users, label: "Dentists", section: "main" },
  { key: "technicians", href: "/staff", icon: Wrench, label: "Technicians", section: "main" },
  { key: "lawyers", href: "/staff", icon: Users, label: "Lawyers", section: "main" },
  { key: "tables", href: "/resources", icon: LayoutGrid, label: "Tables", section: "main" },
  { key: "resources", href: "/resources", icon: LayoutGrid, label: "Resources", section: "main" },
  { key: "jobs", href: "/jobs", icon: Wrench, label: "Jobs", section: "main" },
  { key: "vehicles", href: "/jobs", icon: Wrench, label: "Vehicles", section: "main" },
  { key: "bookings", href: "/appointments", icon: Calendar, label: "Bookings", section: "main" },
  { key: "dispatch", href: "/queue", icon: ClipboardList, label: "Dispatch", section: "main" },
  { key: "serviceStatus", href: "/jobs", icon: Wrench, label: "Service Status", section: "main" },
  { key: "enquiries", href: "/contacts", icon: Users, label: "Enquiries", section: "main" },
  { key: "admissions", href: "/contacts", icon: Users, label: "Admissions", section: "main" },
  { key: "batches", href: "/resources", icon: LayoutGrid, label: "Batches", section: "main" },
  { key: "matters", href: "/jobs", icon: Briefcase, label: "Matters", section: "main" },
  { key: "deals", href: "/jobs", icon: Briefcase, label: "Deals", section: "main" },
  { key: "memberships", href: "/memberships", icon: Gift, label: "Memberships", section: "main" },
  { key: "packages", href: "/memberships", icon: Gift, label: "Packages", section: "main" },
  { key: "reviews", href: "/reviews", icon: Star, label: "Reviews", section: "main" },
  { key: "followUps", href: "/reminders", icon: Bell, label: "Follow-ups", section: "main" },
  { key: "payments", href: "/billing", icon: Receipt, label: "Payments", section: "main" },
  { key: "estimates", href: "/jobs", icon: Wrench, label: "Estimates", section: "main" },

  // Configuration
  { key: "channels", href: "/channels", icon: Cable, label: "Channels", section: "config" },
  { key: "knowledge", href: "/knowledge", icon: BookOpen, label: "Knowledge Base", section: "config" },
  { key: "team", href: "/team", icon: Users, label: "Team", roles: ["ADMIN", "OWNER"], section: "config" },

  // Account
  { key: "billing", href: "/billing", icon: Receipt, label: "Billing", roles: ["ADMIN", "OWNER"], section: "account" },
  { key: "settings", href: "/settings", icon: Settings, label: "Settings", section: "account" },
];

export function getNavItem(key: string): NavItemDef | undefined {
  return NAV_REGISTRY.find((item) => item.key === key);
}

export function buildNavFromKeys(keys: string[], role: string): { main: NavItemDef[]; config: NavItemDef[]; account: NavItemDef[] } {
  const seen = new Set<string>();
  const main: NavItemDef[] = [];
  const config: NavItemDef[] = [];
  const account: NavItemDef[] = [];

  for (const key of keys) {
    if (seen.has(key)) continue;
    const item = getNavItem(key);
    if (!item) continue;
    if (item.roles && !item.roles.includes(role)) continue;
    seen.add(key);
    if (item.section === "main") main.push(item);
    else if (item.section === "config") config.push(item);
    else if (item.section === "account") account.push(item);
  }

  return { main, config, account };
}

// Fallback nav for orgs without an industry template.
export function getDefaultNav(role: string): { main: NavItemDef[]; config: NavItemDef[]; account: NavItemDef[] } {
  return buildNavFromKeys(
    ["overview", "inbox", "contacts", "jobs", "resources", "campaigns", "reminders", "appointments", "queue", "services", "staff", "analytics", "channels", "knowledge", "team", "billing", "settings"],
    role
  );
}
