"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button, Card, EmptyState, Input } from "@/components/ui";

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [instagramUserId, setInstagramUserId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .finally(() => setLoaded(true));
  }

  useEffect(refresh, []);

  async function addContact() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, telegramChatId, instagramUserId }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to add contact");
      return;
    }
    setStatus("idle");
    setName("");
    setEmail("");
    setPhone("");
    setTelegramChatId("");
    setInstagramUserId("");
    refresh();
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-text">Contacts</h1>
        <p className="text-sm text-text-secondary">
          Customers land here automatically from inbound messages — add one manually to test
          campaigns and reminders, or to reach someone before they&apos;ve messaged you.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="w-full flex-shrink-0 lg:max-w-md">
          <Card className="flex flex-col gap-3 p-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
            <Input
              label="Phone (WhatsApp & Voice — E.164)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
            />
            <Input
              label="Telegram chat ID"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
            <Input
              label="Instagram user ID"
              value={instagramUserId}
              onChange={(e) => setInstagramUserId(e.target.value)}
            />
            <Button
              onClick={addContact}
              loading={status === "saving"}
              disabled={!email && !phone && !telegramChatId && !instagramUserId}
              className="w-fit"
            >
              {status === "saving" ? "Adding..." : "Add contact"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </Card>
        </div>

        <div className="flex-1">
          {!loaded ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : contacts.length === 0 ? (
            <EmptyState icon={Users} title="No contacts yet" description="Add one using the form." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-text-secondary">
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Name</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Email</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Phone</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Telegram</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Instagram</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0 transition-colors hover:bg-hover">
                      <td className="px-3 py-2.5 text-text">{c.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{c.email ?? "—"}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{c.phone ?? "—"}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{c.telegramChatId ?? "—"}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{c.instagramUserId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
