"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { Button, Card, Select, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const CHANNELS = [
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "SMS", label: "SMS", icon: Bell },
] as const;

const EVENT_OPTIONS = [
  { key: "APPOINTMENT_BOOKED", label: "Appointment booked" },
  { key: "APPOINTMENT_CHANGED", label: "Appointment changed" },
  { key: "QUEUE_JOINED", label: "Joined queue" },
  { key: "QUEUE_CALLED", label: "Called from queue" },
  { key: "SERVICE_STARTED", label: "Service started" },
  { key: "SERVICE_COMPLETED", label: "Service completed" },
  { key: "PAYMENT_RECEIVED", label: "Payment received" },
  { key: "REVIEW_RECEIVED", label: "Review received" },
  { key: "FOLLOW_UP_DUE", label: "Follow-up due" },
  { key: "MEMBERSHIP_EXPIRING", label: "Membership expiring" },
];

type Channel = (typeof CHANNELS)[number]["key"];

const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SMS: "SMS",
};

interface ContactSummary {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface NotificationPreference {
  id: string;
  contactId: string;
  channel: string;
  enabled: boolean;
  events: string[];
}

export function NotificationPreferencesTab() {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [saving, setSaving] = useState<Record<Channel, boolean>>({
    WHATSAPP: false,
    EMAIL: false,
    SMS: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadContacts() {
      try {
        const res = await fetch("/api/contacts");
        if (!res.ok) throw new Error("Failed to load contacts");
        const data = await res.json();
        const list: ContactSummary[] = data.contacts ?? [];
        if (!cancelled) {
          setContacts(list);
          setSelectedContactId((prev) => prev || list[0]?.id || "");
        }
      } catch {
        if (!cancelled) setError("Failed to load contacts");
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    }
    loadContacts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedContactId) return;
    let cancelled = false;
    async function loadPrefs() {
      setLoadingPrefs(true);
      try {
        const res = await fetch(`/api/notification-preferences?contactId=${selectedContactId}`);
        if (!res.ok) throw new Error("Failed to load preferences");
        const data = await res.json();
        if (!cancelled) {
          setPreferences(data.preferences ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load preferences");
      } finally {
        if (!cancelled) setLoadingPrefs(false);
      }
    }
    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, [selectedContactId]);

  function getPreference(channel: Channel): NotificationPreference | undefined {
    return preferences.find((p) => p.channel === channel);
  }

  function isEnabled(channel: Channel): boolean {
    return getPreference(channel)?.enabled ?? true;
  }

  function selectedEvents(channel: Channel): string[] {
    return getPreference(channel)?.events ?? [];
  }

  function updateLocalPreference(channel: Channel, enabled: boolean, events: string[]) {
    setPreferences((prev) => {
      const existing = prev.find((p) => p.channel === channel);
      if (existing) {
        return prev.map((p) => (p.channel === channel ? { ...p, enabled, events } : p));
      }
      return [
        ...prev,
        {
          id: "",
          contactId: selectedContactId,
          channel,
          enabled,
          events,
        },
      ];
    });
  }

  async function saveChannel(channel: Channel, enabled: boolean, events: string[]) {
    setSaving((prev) => ({ ...prev, [channel]: true }));
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContactId,
          channel,
          enabled,
          events,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to save");
        return;
      }
      if (data.preference) {
        setPreferences((prev) => {
          const existing = prev.find((p) => p.channel === channel);
          if (existing) {
            return prev.map((p) => (p.channel === channel ? data.preference : p));
          }
          return [...prev, data.preference];
        });
      }
      showToast("success", `${CHANNEL_LABELS[channel]} preferences saved`);
    } catch {
      showToast("error", "Network error — try again");
    } finally {
      setSaving((prev) => ({ ...prev, [channel]: false }));
    }
  }

  if (loadingContacts) {
    return <Skeleton className="h-48" />;
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-danger">{error}</p>;
  }

  if (contacts.length === 0) {
    return <p className="py-8 text-center text-sm text-text-secondary">No contacts yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Choose which events each contact should be notified about on each channel.
      </p>

      <Select
        label="Contact"
        value={selectedContactId}
        onChange={(e) => setSelectedContactId(e.target.value)}
      >
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name ?? "Unnamed"}
            {c.phone ? ` · ${c.phone}` : ""}
            {c.email ? ` · ${c.email}` : ""}
          </option>
        ))}
      </Select>

      {loadingPrefs ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {CHANNELS.map(({ key, label, icon: Icon }) => {
            const enabled = isEnabled(key);
            const events = selectedEvents(key);
            return (
              <Card key={key} className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-text">{label}</h3>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => updateLocalPreference(key, e.target.checked, events)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    Enabled
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-text">Events</p>
                  {EVENT_OPTIONS.map((ev) => {
                    const checked = events.includes(ev.key);
                    return (
                      <label
                        key={ev.key}
                        className={`flex items-center gap-2 text-sm ${enabled ? "text-text-secondary" : "text-text-muted"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!enabled}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...events, ev.key]
                              : events.filter((k) => k !== ev.key);
                            updateLocalPreference(key, enabled, next);
                          }}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                        />
                        {ev.label}
                      </label>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  className="mt-auto w-full"
                  loading={saving[key]}
                  onClick={() => saveChannel(key, enabled, events)}
                >
                  Save {label}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
