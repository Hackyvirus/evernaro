"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Search, X, Edit3, Calendar, Repeat, User } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SkeletonCard,
} from "@/components/ui";
import { contactLabel } from "@/lib/contact-label";
import { useToast } from "@/components/ui/toast";
import { useRole, isAgentOrAbove } from "../role";

interface UserSummary {
  id: string;
  name: string | null;
  email: string;
}

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

interface ReminderSummary {
  id: string;
  title: string | null;
  type: string;
  message: string;
  scheduledFor: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  error: string | null;
  contact: Contact;
  channel: { type: string };
  assignedTo: UserSummary | null;
}

const TABS = ["all", "upcoming", "sent", "failed", "cancelled"] as const;
type Tab = (typeof TABS)[number];

const TYPE_LABELS: Record<string, string> = {
  APPOINTMENT: "Appointment",
  PAYMENT: "Payment",
  FOLLOW_UP: "Follow-up",
  CALLBACK: "Callback",
  CUSTOM: "Custom",
};

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "SENT") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "info";
}

function recurrenceLabel(r: string) {
  if (r === "DAILY") return "Daily";
  if (r === "WEEKLY") return "Weekly";
  if (r === "MONTHLY") return "Monthly";
  return "";
}

export default function RemindersPage() {
  const { showToast } = useToast();
  const role = useRole();
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  function load() {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d) => {
        setReminders(d.reminders ?? []);
        setLoaded(true);
      });
  }

  useEffect(() => {
    let active = true;
    function poll() {
      fetch("/api/reminders")
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          setReminders(d.reminders ?? []);
          setLoaded(true);
        });
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    let list = reminders;
    if (tab === "upcoming") list = list.filter((r) => r.status === "PENDING");
    if (tab === "sent") list = list.filter((r) => r.status === "SENT");
    if (tab === "failed") list = list.filter((r) => r.status === "FAILED");
    if (tab === "cancelled") list = list.filter((r) => r.status === "CANCELLED");
    if (typeFilter) list = list.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.title ?? "").toLowerCase().includes(q) ||
          r.message.toLowerCase().includes(q) ||
          contactLabel(r.contact).toLowerCase().includes(q)
      );
    }
    return list;
  }, [reminders, tab, typeFilter, search]);

  async function cancel(id: string) {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to cancel reminder");
      } else {
        showToast("success", "Reminder cancelled", data.warning);
      }
    } catch {
      showToast("error", "Network error");
    }
    load();
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Reminders"
        description="Schedule appointment, payment, follow-up, callback, or custom reminders."
      >
        {isAgentOrAbove(role) && (
          <Link href="/reminders/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New reminder
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-primary text-white"
                    : "bg-surface text-text-secondary hover:bg-hover"
                }`}
              >
                {t}
                {t === "all" && <span className="ml-1 opacity-80">({reminders.length})</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Search reminders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
        </div>

        {!loaded ? (
          <div className="flex flex-col gap-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Bell} title="No reminders found" description={tab === "all" ? "Create your first reminder to get started." : "No reminders match the selected filter."} action={
            isAgentOrAbove(role) ? (
              <Link href="/reminders/new">
                <Button variant="secondary" className="mt-3">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New reminder
                </Button>
              </Link>
            ) : undefined
          } />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text">{r.title || "Untitled reminder"}</p>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{r.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" aria-hidden="true" /> {contactLabel(r.contact)}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden="true" /> {new Date(r.scheduledFor).toLocaleString()}</span>
                      {r.recurrence !== "NONE" && <span className="flex items-center gap-1"><Repeat className="h-3 w-3" aria-hidden="true" /> {recurrenceLabel(r.recurrence)}</span>}
                      {r.assignedTo && <span className="flex items-center gap-1"><User className="h-3 w-3" aria-hidden="true" /> Assigned to {r.assignedTo.name ?? r.assignedTo.email}</span>}
                      {r.status === "FAILED" && r.error && <span className="text-danger">{r.error}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "PENDING" && isAgentOrAbove(role) && (
                      <>
                        <button
                          onClick={() => cancel(r.id)}
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-light"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                        </button>
                        <Link href={`/reminders/${r.id}/edit`}>
                          <button className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-hover">
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
