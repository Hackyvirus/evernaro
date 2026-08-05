"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button, Card, Input, PageHeader, Select, Textarea, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { RoleAwareAgentGuard } from "../../../role";

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
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  bodyText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface ReminderDetail {
  id: string;
  title: string | null;
  type: string;
  message: string;
  scheduledFor: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  whatsappTemplateId: string | null;
  contactId: string;
  channelId: string;
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

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditReminderPage() {
  return (
    <RoleAwareAgentGuard>
      <EditReminderPageContent />
    </RoleAwareAgentGuard>
  );
}

function EditReminderPageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [reminder, setReminder] = useState<ReminderDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("CUSTOM");
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [recurrence, setRecurrence] = useState<string>("NONE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/contacts").then((r) => r.json()),
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/whatsapp-templates").then((r) => r.json()),
      fetch(`/api/reminders/${id}`).then((r) => r.json()),
    ]).then(([c, ch, t, r]) => {
      if (!active) return;
      setContacts(c.contacts ?? []);
      setChannels(ch.channels ?? []);
      setTemplates(t.templates ?? []);
      const rem = r.reminder as ReminderDetail | undefined;
      if (!rem) {
        showToast("error", "Reminder not found");
        router.push("/reminders");
        return;
      }
      setReminder(rem);
      setTitle(rem.title ?? "");
      setType(rem.type);
      setMessage(rem.message);
      setScheduledFor(toLocalInputValue(new Date(rem.scheduledFor)));
      setRecurrence(rem.recurrence);
      setLoaded(true);
    }).catch(() => {
      showToast("error", "Failed to load reminder");
      router.push("/reminders");
    });
    return () => {
      active = false;
    };
  }, [id, router, showToast]);

  const selectedChannel = channels.find((c) => c.id === reminder?.channelId);
  const isWhatsApp = selectedChannel?.type === "WHATSAPP";
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  async function submit() {
    if (!reminder) return;
    if (reminder.status !== "PENDING") {
      showToast("error", "Only pending reminders can be edited");
      return;
    }
    setSaving(true);
    const finalMessage = isWhatsApp ? message : message;
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          type,
          message: finalMessage,
          scheduledFor: new Date(scheduledFor).toISOString(),
          recurrence,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to update reminder");
        setSaving(false);
        return;
      }
      showToast("success", "Reminder updated");
      router.push("/reminders");
    } catch {
      showToast("error", "Network error");
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader title="Edit reminder" description="Loading..." />
        <div className="p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!reminder) return null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Edit reminder"
        description="Update title, type, message, schedule, or repeat."
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
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Contact</label>
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text">
                {contactLabel(contacts.find((c) => c.id === reminder.contactId) ?? { name: null, email: null, phone: null, telegramChatId: null, instagramUserId: null })}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Channel</label>
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text">
                {selectedChannel?.type ?? "—"}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <Input
              label="When"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            <Select label="Repeat" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>

          <div className="mb-6">
            {isWhatsApp ? (
              <Select
                label="WhatsApp template"
                value={reminder.whatsappTemplateId ?? ""}
                disabled
                hint="Template changes are not supported while editing. Cancel and create a new reminder if needed."
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
            <Button onClick={submit} loading={saving} disabled={reminder.status !== "PENDING"}>
              <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Save changes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
