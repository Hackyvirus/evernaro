"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  MessageCircle,
  Phone,
  AtSign,
  Search,
  ArrowLeft,
  User,
  Tag,
  Calendar,
  AlertCircle,
  Plus,
  FileText,
  Bell,
} from "lucide-react";
import type { ConversationPriority, ConversationStatus } from "@prisma/client";
import { Avatar, Badge, Button, EmptyState, IconButton, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { ConversationView } from "./[id]/conversation-view";
import { useRole, isAgentOrAbove, isAdmin } from "../role";

type ChannelType = "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

type ContactSummary = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
};

type ConversationSummary = {
  id: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  subject?: string | null;
  assignedToId?: string | null;
  assignedTo: UserOption | null;
  contact: ContactSummary;
  channel: {
    type: ChannelType;
    telegramBotUsername?: string | null;
    emailAddress?: string | null;
    whatsappSourceNumber?: string | null;
    instagramUsername?: string | null;
  };
  messages: {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    sender: "CONTACT" | "AGENT" | "AI";
    isAiDraft: boolean;
    createdAt: string;
  }[];
  lastMessageAt: string;
};

const priorityClasses: Record<ConversationPriority, string> = {
  LOW: "bg-success/10 text-success",
  MEDIUM: "bg-info/10 text-info",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-danger/10 text-danger",
};

const priorityLabels: Record<ConversationPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function channelIcon(type: ChannelType) {
  switch (type) {
    case "EMAIL":
      return <Mail className="h-4 w-4" aria-hidden="true" />;
    case "WHATSAPP":
      return <Phone className="h-4 w-4" aria-hidden="true" />;
    case "INSTAGRAM":
      return <AtSign className="h-4 w-4" aria-hidden="true" />;
    case "VOICE":
      return <Phone className="h-4 w-4" aria-hidden="true" />;
    case "TELEGRAM":
    default:
      return <MessageCircle className="h-4 w-4" aria-hidden="true" />;
  }
}

function channelLabel(type: ChannelType, channel: ConversationSummary["channel"]) {
  if (type === "TELEGRAM") return `Telegram${channel.telegramBotUsername ? ` · @${channel.telegramBotUsername}` : ""}`;
  if (type === "EMAIL") return `Email${channel.emailAddress ? ` · ${channel.emailAddress}` : ""}`;
  if (type === "WHATSAPP") return `WhatsApp${channel.whatsappSourceNumber ? ` · ${channel.whatsappSourceNumber}` : ""}`;
  if (type === "INSTAGRAM") return `Instagram${channel.instagramUsername ? ` · @${channel.instagramUsername}` : ""}`;
  return "Voice";
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function searchParamsString(params: URLSearchParams) {
  const s = params.toString();
  return s ? `?${s}` : "";
}

function filtersFromSearch(params: URLSearchParams) {
  return {
    search: params.get("search") ?? "",
    channel: params.get("channel") ?? "all",
    status: params.get("status") ?? "all",
    priority: params.get("priority") ?? "all",
    assigned: params.get("assigned") ?? "all",
    filter: params.get("filter") ?? "all",
  };
}

export default function InboxShell() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const selectedId = params.id;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [showProfileMobile, setShowProfileMobile] = useState(false);

  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams]);

  const queryString = useMemo(() => searchParamsString(new URLSearchParams(searchParams.toString())), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingList(true);
      const sp = new URLSearchParams();
      if (filters.search) sp.set("search", filters.search);
      if (filters.channel && filters.channel !== "all") sp.set("channel", filters.channel);
      if (filters.status && filters.status !== "all") sp.set("status", filters.status);
      if (filters.priority && filters.priority !== "all") sp.set("priority", filters.priority);
      if (filters.assigned && filters.assigned !== "all") sp.set("assigned", filters.assigned);
      if (filters.filter && filters.filter !== "all") sp.set("filter", filters.filter);

      try {
        const r = await fetch(`/api/conversations?${sp.toString()}`);
        const d = await r.json();
        if (!cancelled) setConversations(d.conversations ?? []);
      } catch {
        showToast("error", "Failed to load conversations");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filters, showToast]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedId) return;
      setLoadingSelected(true);
      try {
        const r = await fetch(`/api/conversations/${selectedId}`);
        if (!r.ok) throw new Error("Failed");
        const d = await r.json();
        if (!cancelled) setSelected(d.conversation ?? null);
      } catch {
        showToast("error", "Failed to load conversation");
      } finally {
        if (!cancelled) setLoadingSelected(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, showToast]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    const path = selectedId ? `/inbox/${selectedId}` : "/inbox";
    router.push(`${path}?${next.toString()}`);
  }

  function selectConversation(id: string) {
    router.push(`/inbox/${id}${queryString}`);
  }

  function closeConversation() {
    router.push(`/inbox${queryString}`);
  }

  async function refresh() {
    const sp = new URLSearchParams();
    if (filters.search) sp.set("search", filters.search);
    if (filters.channel && filters.channel !== "all") sp.set("channel", filters.channel);
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.priority && filters.priority !== "all") sp.set("priority", filters.priority);
    if (filters.assigned && filters.assigned !== "all") sp.set("assigned", filters.assigned);
    if (filters.filter && filters.filter !== "all") sp.set("filter", filters.filter);

    try {
      const [listRes, detailRes] = await Promise.all([
        fetch(`/api/conversations?${sp.toString()}`),
        selectedId ? fetch(`/api/conversations/${selectedId}`) : Promise.resolve(null),
      ]);
      const listData = await listRes.json();
      setConversations(listData.conversations ?? []);
      if (detailRes) {
        const detailData = await detailRes.json();
        setSelected(detailData.conversation ?? null);
      }
    } catch {
      showToast("error", "Failed to refresh");
    }
  }

  async function patchConversation(id: string, body: object) {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Update failed", "error");
      return null;
    }
    const data = await res.json();
    const updated = data.conversation as ConversationSummary;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              priority: updated.priority,
              status: updated.status,
              assignedToId: updated.assignedToId,
              assignedTo: updated.assignedTo,
            }
          : c
      )
    );
    if (selected?.id === updated.id) {
      setSelected((prev) => (prev ? { ...prev, priority: updated.priority, status: updated.status, assignedToId: updated.assignedToId, assignedTo: updated.assignedTo } : prev));
    }
    return updated;
  }

  async function patchContact(contactId: string, body: object) {
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Update failed", "error");
      return null;
    }
    const data = await res.json();
    const updated = data.contact as ContactSummary;
    setConversations((prev) =>
      prev.map((c) => (c.contact.id === contactId ? { ...c, contact: { ...c.contact, ...updated } } : c))
    );
    if (selected?.contact.id === contactId) {
      setSelected((prev) => (prev ? { ...prev, contact: { ...prev.contact, ...updated } } : prev));
    }
    return updated;
  }

  const isMobileListVisible = !selectedId;
  const isMobileDetailVisible = !!selectedId;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left column — filters + conversation list */}
      <div
        className={`flex w-full flex-col border-r border-border md:w-80 lg:w-96 ${
          isMobileDetailVisible ? "hidden md:flex" : "flex"
        }`}
      >
        <InboxFilters filters={filters} onChange={updateFilter} />
        <ConversationList
          conversations={conversations}
          loading={loadingList}
          selectedId={selectedId}
          onSelect={selectConversation}
        />
      </div>

      {/* Center + right columns */}
      <div className={`flex flex-1 flex-col overflow-hidden md:flex ${isMobileListVisible ? "hidden md:flex" : "flex"}`}>
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              description="Choose a conversation from the list to start responding."
            />
          </div>
        ) : loadingSelected ? (
          <div className="flex flex-1 flex-col">
            <div className="border-b border-border px-6 py-4">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="flex-1 space-y-4 p-6">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Center — thread */}
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
                <div className="flex items-center gap-3">
                  <IconButton
                    label="Back to conversations"
                    className="md:hidden"
                    onClick={closeConversation}
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </IconButton>
                  <div>
                    <h2 className="text-sm font-semibold text-text">{contactLabel(selected.contact)}</h2>
                    <p className="text-xs text-text-secondary">{channelLabel(selected.channel.type, selected.channel)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    label="Customer profile"
                    className="lg:hidden"
                    onClick={() => setShowProfileMobile(true)}
                  >
                    <User className="h-5 w-5" aria-hidden="true" />
                  </IconButton>
                </div>
              </header>
              <ConversationView conversation={selected} onRefresh={refresh} />
            </div>

            {/* Right — customer profile */}
            <div className="hidden lg:flex lg:w-80 xl:w-96 lg:flex-col lg:border-l lg:border-border">
              <CustomerProfile
                conversation={selected}
                users={users}
                onUpdateConversation={patchConversation}
                onUpdateContact={patchContact}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={AlertCircle} title="Conversation not found" description="It may have been deleted or you don't have access." />
          </div>
        )}
      </div>

      {/* Mobile profile drawer */}
      {showProfileMobile && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 md:hidden">
          <div className="flex w-80 max-w-full flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-text">Customer profile</h2>
              <IconButton label="Close profile" onClick={() => setShowProfileMobile(false)}>
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CustomerProfile
                conversation={selected}
                users={users}
                onUpdateConversation={patchConversation}
                onUpdateContact={patchContact}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InboxFilters({
  filters,
  onChange,
}: {
  filters: ReturnType<typeof filtersFromSearch>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <Input
          placeholder="Search name, phone, email..."
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={filters.filter}
          onChange={(e) => onChange("filter", e.target.value)}
          className="h-8 text-xs"
          aria-label="Conversation filter"
        >
          <option value="all">All conversations</option>
          <option value="unread">Unread</option>
          <option value="waiting">Waiting for reply</option>
          <option value="draft">AI draft ready</option>
          <option value="resolved">Resolved</option>
        </Select>
        <Select
          value={filters.channel}
          onChange={(e) => onChange("channel", e.target.value)}
          className="h-8 text-xs"
          aria-label="Channel filter"
        >
          <option value="all">All channels</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="EMAIL">Email</option>
          <option value="VOICE">Voice</option>
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => onChange("status", e.target.value)}
          className="h-8 text-xs"
          aria-label="Status filter"
        >
          <option value="all">Any status</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select
          value={filters.priority}
          onChange={(e) => onChange("priority", e.target.value)}
          className="h-8 text-xs"
          aria-label="Priority filter"
        >
          <option value="all">Any priority</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>
        <Select
          value={filters.assigned}
          onChange={(e) => onChange("assigned", e.target.value)}
          className="col-span-2 h-8 text-xs"
          aria-label="Assignment filter"
        >
          <option value="all">Any assignment</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
        </Select>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 p-4">
        <EmptyState
          icon={MessageCircle}
          title="No conversations"
          description="Connect a channel and start receiving messages."
          compact
        />
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto" role="listbox" aria-label="Conversations">
      {conversations.map((c) => {
        const last = c.messages[0];
        const isSelected = c.id === selectedId;
        const isUnread = !!last && last.direction === "INBOUND";
        return (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors ${
                isSelected ? "bg-hover" : "hover:bg-hover"
              }`}
              aria-selected={isSelected}
              role="option"
            >
              <Avatar name={c.contact.name ?? undefined} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${isUnread ? "font-semibold text-text" : "font-medium text-text"}`}>
                    {contactLabel(c.contact)}
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">{formatTime(c.lastMessageAt)}</span>
                </div>
                <p className="truncate text-sm text-text-secondary">{last?.isAiDraft ? "AI draft ready — " : ""}{last?.body ?? "No messages"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-text-muted" title={channelLabel(c.channel.type, c.channel)}>
                    {channelIcon(c.channel.type)}
                  </span>
                  <Badge variant={c.status === "CLOSED" ? "success" : "default"} className="text-[10px]">
                    {c.status === "CLOSED" ? "Resolved" : "Open"}
                  </Badge>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityClasses[c.priority]}`}>
                    {priorityLabels[c.priority]}
                  </span>
                  {c.assignedTo && (
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <User className="h-3 w-3" aria-hidden="true" />
                      {c.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CustomerProfile({
  conversation,
  users,
  onUpdateConversation,
  onUpdateContact,
}: {
  conversation: ConversationSummary;
  users: UserOption[];
  onUpdateConversation: (id: string, body: object) => Promise<ConversationSummary | null>;
  onUpdateContact: (id: string, body: object) => Promise<ContactSummary | null>;
}) {
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(conversation.contact.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [company, setCompany] = useState(conversation.contact.company ?? "");
  const [savingCompany, setSavingCompany] = useState(false);

  const tags = conversation.contact.tags ?? [];
  const role = useRole();

  async function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.includes(value)) return;
    await onUpdateContact(conversation.contact.id, { tags: [...tags, value] });
    setTagInput("");
  }

  async function removeTag(value: string) {
    await onUpdateContact(conversation.contact.id, { tags: tags.filter((t) => t !== value) });
  }

  async function saveNotes() {
    setSavingNotes(true);
    await onUpdateContact(conversation.contact.id, { notes });
    setSavingNotes(false);
  }

  async function saveCompany() {
    setSavingCompany(true);
    await onUpdateContact(conversation.contact.id, { company });
    setSavingCompany(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar name={conversation.contact.name ?? undefined} className="h-12 w-12" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text">{contactLabel(conversation.contact)}</h3>
            <p className="text-xs text-text-secondary">{channelLabel(conversation.channel.type, conversation.channel)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Status</label>
          <div className="flex items-center gap-2">
          <Select
            value={conversation.status}
            onChange={(e) => onUpdateConversation(conversation.id, { status: e.target.value })}
            className="h-8 text-xs"
            aria-label="Conversation status"
            disabled={!isAgentOrAbove(role)}
          >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Resolved</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Priority</label>
          <Select
            value={conversation.priority}
            onChange={(e) => onUpdateConversation(conversation.id, { priority: e.target.value })}
            className="h-8 text-xs"
            aria-label="Conversation priority"
            disabled={!isAgentOrAbove(role)}
          >
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Assigned to</label>
          <Select
            value={conversation.assignedToId ?? "none"}
            onChange={(e) => onUpdateConversation(conversation.id, { assignedToId: e.target.value === "none" ? null : e.target.value })}
            className="h-8 text-xs"
            aria-label="Assign conversation"
            disabled={!isAdmin(role)}
          >
            <option value="none">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Company</label>
          <div className="flex items-center gap-2">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-xs" placeholder="Add company" disabled={!isAgentOrAbove(role)} />
            <Button size="sm" onClick={saveCompany} loading={savingCompany} disabled={!isAgentOrAbove(role)}>
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Contact info</label>
          <div className="space-y-1 text-xs text-text-secondary">
            {conversation.contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {conversation.contact.email}
              </div>
            )}
            {conversation.contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {conversation.contact.phone}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Last active {formatTime(conversation.lastMessageAt)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Tags</label>
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 && <span className="text-xs text-text-muted">No tags</span>}
            {tags.map((tag) => (
              <Badge key={tag} variant="default" className="flex items-center gap-1 text-[10px]">
                <Tag className="h-3 w-3" aria-hidden="true" />
                {tag}
                {isAgentOrAbove(role) && (
                  <button onClick={() => removeTag(tag)} className="cursor-pointer text-text-muted hover:text-text" aria-label={`Remove tag ${tag}`}>
                    ×
                  </button>
                )}
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
              className="h-8 text-xs"
              disabled={!isAgentOrAbove(role)}
            />
            <Button size="sm" variant="secondary" onClick={addTag} disabled={!isAgentOrAbove(role)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes about this contact..."
            rows={4}
            className="text-xs"
            disabled={!isAgentOrAbove(role)}
          />
          <Button size="sm" onClick={saveNotes} loading={savingNotes} disabled={!isAgentOrAbove(role)}>
            Save notes
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/reminders?contactId=${conversation.contact.id}`} className="w-full">
            <Button size="sm" variant="secondary" className="w-full">
              <Bell className="mr-1 h-4 w-4" aria-hidden="true" />
              Reminder
            </Button>
          </Link>
          <Link href="/contacts" className="w-full">
            <Button size="sm" variant="secondary" className="w-full">
              <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
              View contact
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
