"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Mail, Phone, MessageCircle, AtSign, Search, Plus, Upload, Tag, X } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, PhoneInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SkeletonTable, Badge, Select, Avatar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { useRole, isAgentOrAbove, isAdmin } from "../role";

interface ContactCount {
  conversations: number;
  campaignRecipients: number;
  reminders: number;
}

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
  _count: ContactCount;
}

function channelIcons(contact: Contact) {
  const icons: ReactNode[] = [];
  if (contact.email) icons.push(<Mail key="email" className="h-3.5 w-3.5" aria-hidden="true" />);
  if (contact.phone) icons.push(<Phone key="phone" className="h-3.5 w-3.5" aria-hidden="true" />);
  if (contact.telegramChatId) icons.push(<MessageCircle key="telegram" className="h-3.5 w-3.5" aria-hidden="true" />);
  if (contact.instagramUserId) icons.push(<AtSign key="instagram" className="h-3.5 w-3.5" aria-hidden="true" />);
  return icons;
}

function filtersFromSearch(params: URLSearchParams) {
  return {
    search: params.get("search") ?? "",
    channel: params.get("channel") ?? "all",
    tag: params.get("tag") ?? "",
  };
}

function buildSearch(filters: { search: string; channel: string; tag: string }) {
  const sp = new URLSearchParams();
  if (filters.search) sp.set("search", filters.search);
  if (filters.channel && filters.channel !== "all") sp.set("channel", filters.channel);
  if (filters.tag) sp.set("tag", filters.tag);
  return sp.toString();
}

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const role = useRole();
  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [instagramUserId, setInstagramUserId] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchContacts() {
      setLoaded(false);
      try {
        const r = await fetch(`/api/contacts?${buildSearch(filters)}`);
        const d = await r.json();
        if (!cancelled) setContacts(d.contacts ?? []);
      } catch {
        showToast("error", "Failed to load contacts");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchContacts();
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey, showToast]);

  function updateFilter(key: string, value: string) {
    const next = { ...filters, [key]: value };
    const sp = new URLSearchParams();
    if (next.search) sp.set("search", next.search);
    if (next.channel && next.channel !== "all") sp.set("channel", next.channel);
    if (next.tag) sp.set("tag", next.tag);
    router.push(`/contacts?${sp.toString()}`);
  }

  async function addContact() {
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          telegramChatId,
          instagramUserId,
          company,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to add contact");
        return;
      }
      showToast("success", "Contact added");
      resetForm();
      setShowAdd(false);
      setRefreshKey((k) => k + 1);
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setTelegramChatId("");
    setInstagramUserId("");
    setCompany("");
    setTags("");
    setNotes("");
  }

  async function importContacts() {
    if (!importFile) return;
    setImporting(true);
    const form = new FormData();
    form.append("file", importFile);
    try {
      const res = await fetch("/api/contacts/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Import failed");
        return;
      }
      showToast("success", `Imported ${data.created} contacts`, data.errors.length ? `${data.errors.length} errors` : undefined);
      setShowImport(false);
      setImportFile(null);
      setRefreshKey((k) => k + 1);
    } catch {
      showToast("error", "Network error");
    } finally {
      setImporting(false);
    }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Contacts"
        description="Customers land here automatically from inbound messages — add, import, and manage them."
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <Input
                placeholder="Search name, email, phone..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.channel}
              onChange={(e) => updateFilter("channel", e.target.value)}
              className="h-10 w-40"
              aria-label="Channel filter"
            >
              <option value="all">All channels</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
            </Select>
            <Select
              value={filters.tag}
              onChange={(e) => updateFilter("tag", e.target.value)}
              className="h-10 w-40"
              aria-label="Tag filter"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin(role) && (
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Import
              </Button>
            )}
            {isAgentOrAbove(role) && (
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add contact
              </Button>
            )}
          </div>
        </div>

        {!loaded ? (
          <SkeletonTable rows={6} columns={6} />
        ) : contacts.length === 0 ? (
          <EmptyState icon={Users} title="No contacts yet" description="Add a contact or import a CSV to get started." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Contact</TableHeader>
                <TableHeader>Channels</TableHeader>
                <TableHeader>Company</TableHeader>
                <TableHeader>Tags</TableHeader>
                <TableHeader>Activity</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name ?? undefined} className="h-9 w-9" />
                      <div>
                        <p className="text-sm font-medium text-text">{contactLabel(c)}</p>
                        <p className="text-xs text-text-secondary">{c.email || c.phone || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      {channelIcons(c).length > 0 ? channelIcons(c) : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-text-secondary">{c.company ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.tags?.length ? c.tags.map((t) => (
                        <Badge key={t} variant="default" className="text-[10px]">
                          <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                          {t}
                        </Badge>
                      )) : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-text-secondary">
                    {c._count.conversations} conversations
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/contacts/${c.id}`}>
                      <Button size="sm" variant="secondary">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Add contact</h2>
              <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text" aria-label="Close">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <PhoneInput label="Phone" value={phone} onChange={setPhone} />
              <Input label="Telegram chat ID" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
              <Input label="Instagram user ID" value={instagramUserId} onChange={(e) => setInstagramUserId(e.target.value)} />
              <Input label="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} className="sm:col-span-2" />
              <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-2" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addContact} loading={saving} disabled={!email && !phone && !telegramChatId && !instagramUserId}>
                Add contact
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Import contacts</h2>
              <button onClick={() => setShowImport(false)} className="text-text-muted hover:text-text" aria-label="Close">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-3 text-sm text-text-secondary">
              Upload a CSV with columns: <code className="rounded bg-surface px-1 text-xs">name, email, phone, telegramChatId, instagramUserId, company, tags, notes</code>. At least one channel identifier is required per row.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary file:mr-4 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:text-white"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
              <Button onClick={importContacts} loading={importing} disabled={!importFile}>Import</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
