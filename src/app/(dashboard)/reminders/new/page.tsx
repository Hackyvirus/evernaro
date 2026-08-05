"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button, Card, Input, PageHeader, Select, Textarea, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { RoleAwareAgentGuard } from "../../role";

interface UserSummary {
  id: string;
  name: string | null;
  email: string;
}

interface ContactOption {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

interface ChannelOption {
  id: string;
  type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
  telegramBotUsername: string | null;
  emailAddress: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  bodyText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const REMINDER_TYPES = [
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "PAYMENT", label: "Payment" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "CALLBACK", label: "Callback" },
  { value: "CUSTOM", label: "Custom" },
] as const;

const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "Once" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

function channelLabel(c: ChannelOption) {
  if (c.type === "TELEGRAM") return `Telegram${c.telegramBotUsername ? ` · @${c.telegramBotUsername}` : ""}`;
  if (c.type === "EMAIL") return `Email${c.emailAddress ? ` · ${c.emailAddress}` : ""}`;
  if (c.type === "WHATSAPP") return `WhatsApp${c.whatsappSourceNumber ? ` · ${c.whatsappSourceNumber}` : ""}`;
  return `Instagram${c.instagramUsername ? ` · @${c.instagramUsername}` : ""}`;
}

function toLocalInputValue(d = new Date(Date.now() + 60 * 60 * 1000)) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewReminderPage() {
  return (
    <RoleAwareAgentGuard>
      <NewReminderPageContent />
    </RoleAwareAgentGuard>
  );
}

function NewReminderPageContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("CUSTOM");
  const [contactId, setContactId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");
  const [scheduledFor, setScheduledFor] = useState(toLocalInputValue());
  const [recurrence, setRecurrence] = useState<string>("NONE");
  const [assignedToId, setAssignedToId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isWhatsApp = selectedChannel?.type === "WHATSAPP";
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const selectedContact = contacts.find((c) => c.id === contactId);
  const selectedTemplate = approvedTemplates.find((t) => t.id === whatsappTemplateId);

  const reachableChannels = useMemo(() => {
    if (!selectedContact) return channels;
    return channels.filter((c) => {
      if (c.type === "TELEGRAM") return selectedContact.telegramChatId;
      if (c.type === "EMAIL") return selectedContact.email;
      if (c.type === "WHATSAPP") return selectedContact.phone;
      if (c.type === "INSTAGRAM") return selectedContact.instagramUserId;
      return false;
    });
  }, [channels, selectedContact]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/contacts").then((r) => r.json()),
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/whatsapp-templates").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([c, ch, t, u]) => {
      if (!active) return;
      setContacts(c.contacts ?? []);
      setChannels(ch.channels ?? []);
      setTemplates(t.templates ?? []);
      setUsers(u.users ?? []);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);



  async function submit() {
    setSaving(true);
    const finalMessage = isWhatsApp && selectedTemplate ? selectedTemplate.bodyText : message;
    const body = {
      contactId,
      channelId,
      title: title || undefined,
      type,
      message: finalMessage,
      whatsappTemplateId: isWhatsApp ? whatsappTemplateId : undefined,
      scheduledFor: new Date(scheduledFor).toISOString(),
      recurrence,
      assignedToId: assignedToId || undefined,
    };
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to create reminder");
        setSaving(false);
        return;
      }
      showToast("success", "Reminder scheduled");
      router.push("/reminders");
    } catch {
      showToast("error", "Network error");
      setSaving(false);
    }
  }

  const canSubmit = isWhatsApp
    ? Boolean(title && contactId && channelId && whatsappTemplateId && scheduledFor)
    : Boolean(title && contactId && channelId && message && scheduledFor);

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader title="New reminder" description="Loading..." />
        <div className="p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="New reminder"
        description="Schedule a one-off or recurring reminder for a contact."
        backHref="/reminders"
      />
      <div className="mx-auto w-full max-w-2xl p-6">
        <Card className="p-6">
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site visit follow-up"
            />
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              {REMINDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <Select label="Contact" value={contactId} onChange={(e) => { setContactId(e.target.value); setChannelId(""); setWhatsappTemplateId(""); }}>
              <option value="">Select a contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{contactLabel(c)}</option>
              ))}
            </Select>
            <Select label="Channel" value={channelId} onChange={(e) => { setChannelId(e.target.value); setWhatsappTemplateId(""); }}>
              <option value="">Select a channel...</option>
              {reachableChannels.map((c) => (
                <option key={c.id} value={c.id}>{channelLabel(c)}</option>
              ))}
            </Select>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <Input
                label="When"
                type="datetime-local"
                className="flex-1"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
              <Select label="Repeat" className="w-32" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                {RECURRENCE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <Select label="Assign to" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </Select>
          </div>

          <div className="mb-6">
            {isWhatsApp ? (
              <Select
                label="WhatsApp template"
                value={whatsappTemplateId}
                onChange={(e) => setWhatsappTemplateId(e.target.value)}
                hint={approvedTemplates.length === 0 ? "No approved templates yet — add one in Settings → WhatsApp first." : "Scheduled WhatsApp sends need an approved template."}
              >
                <option value="">Select an approved template...</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            ) : (
              <Textarea
                label="Message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Reminder: your site visit is tomorrow at 4 PM."
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <Link href="/reminders">
              <Button variant="secondary">
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </Link>
            <Button onClick={submit} loading={saving} disabled={!canSubmit}>
              <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Schedule reminder
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
