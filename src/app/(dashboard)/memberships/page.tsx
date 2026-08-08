"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Plus, Search, Trash2, Edit3, X, Check, Calendar, User } from "lucide-react";
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
import { useRole, isAdmin } from "../role";

interface ContactSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

interface MembershipSummary {
  id: string;
  contactId: string;
  contact: ContactSummary;
  name: string;
  sessionsTotal: number | null;
  sessionsUsed: number;
  expiresAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "EXPIRED") return "warning";
  return "danger";
}

export default function MembershipsPage() {
  const { showToast } = useToast();
  const role = useRole();
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [creating, setCreating] = useState(false);
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [sessionsTotal, setSessionsTotal] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "EXPIRED" | "CANCELLED">("ACTIVE");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSessionsUsed, setEditSessionsUsed] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "EXPIRED" | "CANCELLED">("ACTIVE");

  async function load() {
    try {
      const [mRes, cRes] = await Promise.all([fetch("/api/memberships"), fetch("/api/contacts")]);
      const mData = await mRes.json().catch(() => ({}));
      const cData = await cRes.json().catch(() => ({}));
      setMemberships(mData.memberships ?? []);
      setContacts(cData.contacts ?? []);
      setLoaded(true);
    } catch {
      showToast("error", "Failed to load memberships");
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = memberships;
    if (statusFilter) list = list.filter((m) => m.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          contactLabel(m.contact).toLowerCase().includes(q)
      );
    }
    return list;
  }, [memberships, statusFilter, search]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          name,
          sessionsTotal: sessionsTotal ? Number(sessionsTotal) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to create membership");
      } else {
        showToast("success", "Membership created");
        setContactId("");
        setName("");
        setSessionsTotal("");
        setExpiresAt("");
        setStatus("ACTIVE");
        load();
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(m: MembershipSummary) {
    setEditingId(m.id);
    setEditSessionsUsed(String(m.sessionsUsed));
    setEditStatus(m.status);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSessionsUsed("");
    setEditStatus("ACTIVE");
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/memberships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionsUsed: Number(editSessionsUsed),
          status: editStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to update membership");
      } else {
        showToast("success", "Membership updated");
        setEditingId(null);
        load();
      }
    } catch {
      showToast("error", "Network error");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this membership? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/memberships/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to delete membership");
      } else {
        showToast("success", "Membership deleted");
        load();
      }
    } catch {
      showToast("error", "Network error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Memberships / Packages"
        description="Create and track session-based memberships or packages for your customers."
      />

      <div className="flex flex-col gap-6 p-6">
        {isAdmin(role) && (
          <Card className="p-4">
            <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-text">Customer</label>
                <select
                  required
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-text outline-none focus:border-primary"
                >
                  <option value="">Select customer</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Package name"
                placeholder="e.g. 10-session yoga pack"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Total sessions"
                type="number"
                min={1}
                value={sessionsTotal}
                onChange={(e) => setSessionsTotal(e.target.value)}
                hint="Leave blank for unlimited"
              />
              <Input
                label="Expires at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <div className="flex items-end">
                <Button type="submit" loading={creating} className="w-full">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Create
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Search memberships..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {!loaded ? (
          <div className="flex flex-col gap-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No memberships found"
            description={
              search || statusFilter
                ? "No memberships match your filters."
                : "Create your first membership or package to get started."
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text">{m.name}</p>
                      <Badge variant={statusVariant(m.status)}>{STATUS_LABELS[m.status]}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" aria-hidden="true" /> {contactLabel(m.contact)}
                      </span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                      <span>Sessions: {m.sessionsUsed}{m.sessionsTotal !== null ? ` / ${m.sessionsTotal}` : " used"}</span>
                      {m.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" /> Expires {new Date(m.expiresAt).toLocaleString()}
                        </span>
                      )}
                      <span>Created {new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {editingId === m.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="number"
                        min={0}
                        value={editSessionsUsed}
                        onChange={(e) => setEditSessionsUsed(e.target.value)}
                        className="w-28"
                      />
                      <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} className="w-32">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(m.id)}
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success-light"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-hover"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isAdmin(role) && (
                        <>
                          <button
                            onClick={() => startEdit(m)}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-hover"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                          </button>
                          <button
                            onClick={() => remove(m.id)}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-light"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
