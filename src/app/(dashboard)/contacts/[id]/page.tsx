"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Mail, Phone, MessageCircle, AtSign, Calendar, Tag, Edit, Save, X, Plus, FileText } from "lucide-react";
import { Button, Card, Input, PageHeader, Skeleton, Badge, Textarea, Avatar } from "@/components/ui";
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

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const role = useRole();
  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
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
        const [cRes, convRes] = await Promise.all([
          fetch(`/api/contacts/${params.id}`),
          fetch(`/api/conversations?contactId=${params.id}`),
        ]);
        if (!cRes.ok) {
          router.push("/contacts");
          return;
        }
        const cData = await cRes.json();
        const convData = await convRes.json();
        if (!cancelled) {
          setContact(cData.contact);
          setConversations(convData.conversations ?? []);
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

        {/* Right column — activity */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-text">Recent conversations</h3>
            {conversations.length === 0 ? (
              <p className="text-sm text-text-secondary">No conversations yet.</p>
            ) : (
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
            )}
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
