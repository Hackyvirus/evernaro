"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { contactLabel } from "@/lib/contact-label";
import { Badge, Button, Card, EmptyState, Input, Select, Textarea } from "@/components/ui";

interface Contact {
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

interface ReminderSummary {
  id: string;
  message: string;
  scheduledFor: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  error: string | null;
  contact: Contact;
  channel: { type: string };
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "SENT") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "info";
}

function toLocalInputValue(d = new Date(Date.now() + 60 * 60 * 1000)) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RemindersPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [reminders, setReminders] = useState<ReminderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [contactId, setContactId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");
  const [scheduledFor, setScheduledFor] = useState(toLocalInputValue());
  const [recurrence, setRecurrence] = useState<"NONE" | "DAILY" | "WEEKLY" | "MONTHLY">("NONE");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isWhatsApp = selectedChannel?.type === "WHATSAPP";
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  function refresh() {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d) => setReminders(d.reminders ?? []));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => active && setContacts(d.contacts ?? []));
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => active && setChannels(d.channels ?? []));
    fetch("/api/whatsapp-templates")
      .then((r) => r.json())
      .then((d) => active && setTemplates(d.templates ?? []));

    function poll() {
      fetch("/api/reminders")
        .then((r) => r.json())
        .then((d) => active && setReminders(d.reminders ?? []))
        .finally(() => active && setLoaded(true));
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function createReminder() {
    setStatus("saving");
    setError(null);
    const chosenTemplate = approvedTemplates.find((t) => t.id === whatsappTemplateId);
    const finalMessage = isWhatsApp && chosenTemplate ? chosenTemplate.bodyText : message;
    let res: Response;
    let data;
    try {
      res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          channelId,
          message: finalMessage,
          whatsappTemplateId: isWhatsApp ? whatsappTemplateId : undefined,
          scheduledFor: new Date(scheduledFor).toISOString(),
          recurrence,
        }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to schedule reminder");
      return;
    }
    setStatus("idle");
    setMessage("");
    setWhatsappTemplateId("");
    refresh();
  }

  async function cancel(id: string) {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to cancel reminder");
      } else if (data.warning) {
        setError(data.warning);
      }
    } catch {
      setError("Network error — check your connection and try again.");
    }
    refresh();
  }

  const canSchedule = isWhatsApp
    ? Boolean(contactId && channelId && whatsappTemplateId)
    : Boolean(contactId && channelId && message);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">Reminders</h1>
        <p className="text-sm text-text-secondary">
          Schedule appointment, payment, or follow-up messages — one-off or recurring.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="w-full flex-shrink-0 lg:max-w-md">
          <h2 className="mb-3 text-sm font-medium text-text">New reminder</h2>
          <Card className="flex flex-col gap-3 p-4">
            <Select label="Contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Select a contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contactLabel(c)}
                </option>
              ))}
            </Select>
            <Select label="Channel" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Select a channel...</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type}
                </option>
              ))}
            </Select>

            {isWhatsApp ? (
              <Select
                label="Message template"
                value={whatsappTemplateId}
                onChange={(e) => setWhatsappTemplateId(e.target.value)}
                hint={
                  approvedTemplates.length === 0
                    ? "No approved templates yet — add one in Settings → WhatsApp first."
                    : "Scheduled sends need an approved template — Meta rejects free text outside an active conversation."
                }
              >
                <option value="">Select an approved template...</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Textarea
                label="Message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Reminder: your site visit is tomorrow at 4 PM."
              />
            )}

            <div className="flex gap-3">
              <Input
                label="When"
                type="datetime-local"
                className="flex-1"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
              <Select
                label="Repeat"
                className="w-32"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
              >
                <option value="NONE">Once</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </Select>
            </div>
            <Button onClick={createReminder} loading={status === "saving"} disabled={!canSchedule} className="w-fit">
              {status === "saving" ? "Scheduling..." : "Schedule"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </Card>
        </div>

        <div className="flex-1">
          <h2 className="mb-3 text-sm font-medium text-text">Upcoming &amp; past</h2>
          {!loaded ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : reminders.length === 0 ? (
            <EmptyState icon={Bell} title="No reminders scheduled yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {reminders.map((r) => (
                <li key={r.id}>
                  <Card className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {contactLabel(r.contact)} · {r.channel.type}
                      </p>
                      <p className="text-xs text-text-secondary">{r.message}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(r.scheduledFor).toLocaleString()}
                        {r.recurrence !== "NONE" ? ` · repeats ${r.recurrence.toLowerCase()}` : ""}
                      </p>
                      {r.status === "FAILED" && r.error && (
                        <p className="text-xs text-danger">{r.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => cancel(r.id)}
                          className="cursor-pointer text-xs text-danger hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
