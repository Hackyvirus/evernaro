"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  MessageCircle,
  AtSign,
  Calendar,
  Tag,
  Edit,
  Save,
  X,
  Plus,
  FileText,
  Clock,
  ClipboardList,
  Wrench,
  Gift,
  Star,
  Receipt,
  Activity,
} from "lucide-react";
import { Button, Card, Input, PageHeader, Skeleton, Badge, Textarea, Avatar, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { useRole, isAgentOrAbove } from "../../role";

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
  createdAt: string;
  _count?: {
    conversations: number;
    campaignRecipients: number;
    reminders: number;
  };
}

interface ConversationSummary {
  id: string;
  status: string;
  priority: string;
  lastMessageAt: string;
  channel: { type: string };
  messages: { body: string; createdAt: string }[];
}

interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  service: { name: string } | null;
  staff: { name: string } | null;
  resource: { name: string } | null;
}

interface QueueEntry {
  id: string;
  token: string;
  position: number;
  status: string;
  createdAt: string;
  queue: { name: string };
  service: { name: string } | null;
  staff: { name: string } | null;
}

interface JobCard {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimateInr: number | null;
  createdAt: string;
  service: { name: string } | null;
  staff: { name: string } | null;
}

interface Membership {
  id: string;
  name: string;
  sessionsTotal: number | null;
  sessionsUsed: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  type: string;
  amountInr: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface CustomerEvent {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const role = useRole();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const cRes = await fetch(`/api/contacts/${params.id}`);
        if (!cRes.ok) {
          router.push("/contacts");
          return;
        }
        const cData = await cRes.json();
        if (!cancelled) {
          setContact(cData.contact);
          resetForm(cData.contact);
        }
      } catch {
        showToast("error", "Failed to load contact");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, showToast]);

  function resetForm(c: Contact) {
    setName(c.name ?? "");
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setCompany(c.company ?? "");
    setNotes(c.notes ?? "");
    setTags(c.tags ?? []);
    setTagInput("");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || null, email: email || null, phone: phone || null, company: company || null, notes, tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to save");
        return;
      }
      setContact(data.contact);
      resetForm(data.contact);
      setEditing(false);
      showToast("success", "Contact updated");
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function addTag() {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    await saveTags([...tags, value]);
    setTagInput("");
  }

  async function removeTag(value: string) {
    await saveTags(tags.filter((t) => t !== value));
  }

  async function saveTags(next: string[]) {
    try {
      const res = await fetch(`/api/contacts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed");
        return;
      }
      setContact(data.contact);
      setTags(data.contact.tags ?? []);
    } catch {
      showToast("error", "Network error");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!contact) return null;

  const tabs = [
    { id: "overview", label: "Overview", content: <OverviewTab contactId={contact.id} /> },
    { id: "appointments", label: "Appointments", content: <AppointmentsTab contactId={contact.id} /> },
    { id: "queue", label: "Queue", content: <QueueTab contactId={contact.id} /> },
    { id: "jobs", label: "Jobs", content: <JobCardsTab contactId={contact.id} /> },
    { id: "memberships", label: "Memberships", content: <MembershipsTab contactId={contact.id} /> },
    { id: "reviews", label: "Reviews", content: <ReviewsTab contactId={contact.id} /> },
    { id: "invoices", label: "Payments", content: <InvoicesTab contactId={contact.id} /> },
    { id: "events", label: "Timeline", content: <EventsTab contactId={contact.id} /> },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title={contactLabel(contact)}
        description={contact.company ?? "Contact detail"}
        backHref="/contacts"
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* Left column — profile */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={contact.name ?? undefined} className="h-16 w-16" />
              <div>
                <h2 className="text-lg font-semibold text-text">{contactLabel(contact)}</h2>
                <p className="text-sm text-text-secondary">{contact.company || "No company"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {contact.email}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {contact.phone}
                </div>
              )}
              {contact.telegramChatId && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Telegram: {contact.telegramChatId}
                </div>
              )}
              {contact.instagramUserId && (
                <div className="flex items-center gap-2">
                  <AtSign className="h-4 w-4" aria-hidden="true" />
                  Instagram: {contact.instagramUserId}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Added {new Date(contact.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {isAgentOrAbove(role) && (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditing(true)}>
                  <Edit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
              )}
              <Link href={`/inbox?search=${encodeURIComponent(contact.email ?? contact.phone ?? contact.telegramChatId ?? contact.instagramUserId ?? "")}`} className="w-full">
                <Button variant="secondary" size="sm" className="w-full">
                  <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Inbox
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text">Tags</h3>
            <div className="mb-3 flex flex-wrap gap-1">
              {tags.length === 0 && <span className="text-sm text-text-secondary">No tags</span>}
              {tags.map((tag) => (
                <Badge key={tag} variant="default" className="flex items-center gap-1 text-xs">
                  <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                  {tag}
                  <button onClick={() => removeTag(tag)} className="cursor-pointer text-text-muted hover:text-text" aria-label={`Remove tag ${tag}`}>×</button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag"
                className="h-8 text-sm"
              />
              <Button size="sm" variant="secondary" onClick={addTag}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-text">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private notes..."
              rows={5}
              className="text-sm"
            />
            <Button size="sm" className="mt-2" onClick={save} loading={saving}>Save notes</Button>
          </Card>
        </div>

        {/* Right column — activity tabs */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <Tabs tabs={tabs} defaultTab="overview" />
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Edit contact</h2>
              <button onClick={() => setEditing(false)} className="text-text-muted hover:text-text" aria-label="Close">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save} loading={saving}>
                <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-text-secondary">{message}</p>;
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-danger">{message}</p>;
}

function useTabData<T>(url: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

function OverviewTab({ contactId }: { contactId: string }) {
  const { data, loading, error } = useTabData<ConversationSummary>(`/api/conversations?contactId=${contactId}`);
  const conversations = (data as unknown as { conversations?: ConversationSummary[] })?.conversations ?? [];

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (conversations.length === 0) return <Empty message="No conversations yet." />;

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
        <FileText className="h-4 w-4" aria-hidden="true" />
        Recent conversations
      </h3>
      <ul className="divide-y divide-border">
        {conversations.map((conv) => {
          const last = conv.messages[0];
          return (
            <li key={conv.id} className="py-3">
              <Link href={`/inbox/${conv.id}`} className="flex items-center justify-between gap-3 hover:text-primary">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{last?.body ?? "No messages"}</p>
                  <p className="text-xs text-text-secondary">{conv.channel.type} · {new Date(conv.lastMessageAt).toLocaleString()}</p>
                </div>
                <Badge variant={conv.status === "CLOSED" ? "success" : "default"}>{conv.status === "CLOSED" ? "Resolved" : "Open"}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AppointmentsTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/appointments`);
  const appointments = ((json as unknown as { appointments?: Appointment[] })?.appointments ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (appointments.length === 0) return <Empty message="No appointments yet." />;

  return (
    <ul className="divide-y divide-border">
      {appointments.map((a) => (
        <li key={a.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                {a.service?.name ?? "Appointment"} {a.staff && `· ${a.staff.name}`}
              </p>
              <p className="text-xs text-text-secondary">
                <Clock className="mr-1 inline h-3 w-3" />
                {new Date(a.startsAt).toLocaleString()} - {new Date(a.endsAt).toLocaleTimeString()}
                {a.resource && ` · ${a.resource.name}`}
              </p>
              {a.notes && <p className="mt-1 text-xs text-text-muted">{a.notes}</p>}
            </div>
            <Badge variant="default">{a.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function QueueTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/queue`);
  const entries = ((json as unknown as { entries?: QueueEntry[] })?.entries ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (entries.length === 0) return <Empty message="No queue history yet." />;

  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => (
        <li key={e.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                <ClipboardList className="mr-1 inline h-3 w-3" />
                {e.token} · {e.queue.name}
              </p>
              <p className="text-xs text-text-secondary">
                #{e.position} {e.service && `· ${e.service.name}`} {e.staff && `· ${e.staff.name}`}
              </p>
              <p className="text-xs text-text-muted">Joined {new Date(e.createdAt).toLocaleString()}</p>
            </div>
            <Badge variant="default">{e.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function JobCardsTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/job-cards`);
  const jobCards = ((json as unknown as { jobCards?: JobCard[] })?.jobCards ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (jobCards.length === 0) return <Empty message="No job cards yet." />;

  return (
    <ul className="divide-y divide-border">
      {jobCards.map((j) => (
        <li key={j.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                <Wrench className="mr-1 inline h-3 w-3" />
                {j.title}
              </p>
              <p className="text-xs text-text-secondary">
                {j.service?.name} {j.staff && `· ${j.staff.name}`} {j.estimateInr ? `· Est. ₹${j.estimateInr}` : ""}
              </p>
              {j.description && <p className="mt-1 text-xs text-text-muted">{j.description}</p>}
            </div>
            <Badge variant="default">{j.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MembershipsTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/memberships`);
  const memberships = ((json as unknown as { memberships?: Membership[] })?.memberships ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (memberships.length === 0) return <Empty message="No memberships or packages yet." />;

  return (
    <ul className="divide-y divide-border">
      {memberships.map((m) => (
        <li key={m.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                <Gift className="mr-1 inline h-3 w-3" />
                {m.name}
              </p>
              <p className="text-xs text-text-secondary">
                {m.sessionsTotal !== null ? `${m.sessionsUsed} / ${m.sessionsTotal} sessions used` : "Unlimited sessions"}
                {m.expiresAt && ` · Expires ${new Date(m.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
            <Badge variant={m.status === "ACTIVE" ? "success" : "default"}>{m.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReviewsTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/reviews`);
  const reviews = ((json as unknown as { reviews?: Review[] })?.reviews ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (reviews.length === 0) return <Empty message="No reviews yet." />;

  return (
    <ul className="divide-y divide-border">
      {reviews.map((r) => (
        <li key={r.id} className="py-3">
          <div className="flex items-start gap-3">
            <Star className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text">{r.rating} / 5</p>
              {r.comment && <p className="text-sm text-text-secondary">{r.comment}</p>}
              <p className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function InvoicesTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/invoices`);
  const invoices = ((json as unknown as { invoices?: Invoice[] })?.invoices ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (invoices.length === 0) return <Empty message="No invoices yet." />;

  return (
    <ul className="divide-y divide-border">
      {invoices.map((inv) => (
        <li key={inv.id} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                <Receipt className="mr-1 inline h-3 w-3" />
                {inv.type === "WALLET_TOPUP" ? "Wallet top-up" : "Subscription"}
              </p>
              <p className="text-xs text-text-secondary">
                ₹{inv.amountInr} · {new Date(inv.createdAt).toLocaleDateString()}
                {inv.paidAt && ` · Paid ${new Date(inv.paidAt).toLocaleDateString()}`}
              </p>
            </div>
            <Badge variant={inv.status === "PAID" ? "success" : inv.status === "FAILED" ? "danger" : "default"}>{inv.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EventsTab({ contactId }: { contactId: string }) {
  const { data: json, loading, error } = useTabData<unknown>(`/api/contacts/${contactId}/events`);
  const events = ((json as unknown as { events?: CustomerEvent[] })?.events ?? []);

  if (loading) return <Skeleton className="h-48" />;
  if (error) return <ErrorMessage message={error} />;
  if (events.length === 0) return <Empty message="No timeline events yet." />;

  return (
    <ul className="divide-y divide-border">
      {events.map((ev) => (
        <li key={ev.id} className="py-3">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text">{ev.type}</p>
              {ev.entityType && <p className="text-xs text-text-secondary">{ev.entityType} · {ev.entityId}</p>}
              <p className="text-xs text-text-muted">{new Date(ev.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
