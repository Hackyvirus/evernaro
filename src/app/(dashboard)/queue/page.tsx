"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type QueueEntry = {
  id: string;
  token: string;
  position: number;
  status: string;
  contact: { name: string | null; phone: string | null };
  service: { name: string } | null;
};

type Queue = {
  id: string;
  name: string;
  entries: QueueEntry[];
};

type ContactOption = { id: string; name: string | null; phone: string | null };
type ServiceOption = { id: string; name: string };

export default function QueuePage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQueueName, setNewQueueName] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [contactId, setContactId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [queueRes, contactRes, serviceRes] = await Promise.all([
      fetch("/api/queue"),
      fetch("/api/contacts"),
      fetch("/api/services"),
    ]);
    const queueData = await queueRes.json();
    const contactData = await contactRes.json();
    const serviceData = await serviceRes.json();
    const q = queueData.queues ?? [];
    setQueues(q);
    setContacts(contactData.contacts ?? []);
    setServices(serviceData.services ?? []);
    if (q.length > 0 && !selectedQueueId) setSelectedQueueId(q[0].id);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueueId]);

  async function createQueue(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newQueueName }),
    });
    setSubmitting(false);
    if (res.ok) {
      setNewQueueName("");
      load();
    }
  }

  async function joinQueue(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/queue", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queueId: selectedQueueId,
        contactId,
        serviceId: serviceId || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setContactId("");
      setServiceId("");
      load();
    }
  }

  async function callNext(queueId: string) {
    await fetch(`/api/queue/${queueId}/call-next`, { method: "POST", body: JSON.stringify({}) });
    load();
  }

  async function updateStatus(entryId: string, status: string) {
    await fetch(`/api/queue/entries/${entryId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const activeQueue = queues.find((q) => q.id === selectedQueueId);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Queue" description="Manage walk-ins and live waiting list." />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card className="p-4">
          <form onSubmit={createQueue} className="flex max-w-md gap-3">
            <Input label="Queue name" value={newQueueName} onChange={(e) => setNewQueueName(e.target.value)} />
            <div className="flex items-end">
              <Button type="submit" loading={submitting}>
                Create queue
              </Button>
            </div>
          </form>
        </Card>

        {queues.length > 0 && (
          <Card className="p-4">
            <form onSubmit={joinQueue} className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Queue</label>
                <select
                  value={selectedQueueId}
                  onChange={(e) => setSelectedQueueId(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                >
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Customer</label>
                <select
                  required
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                >
                  <option value="">Select customer</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone || c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Service</label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                >
                  <option value="">Any</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" loading={submitting} className="w-full">
                  Join queue
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : activeQueue ? (
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-text">{activeQueue.name}</h3>
              <Button size="sm" onClick={() => callNext(activeQueue.id)}>
                Call next
              </Button>
            </div>
            {activeQueue.entries.length === 0 ? (
              <p className="text-sm text-text-secondary">No one in queue.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeQueue.entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-text">
                        {e.token} · {e.contact.name || e.contact.phone || "Unknown"}
                      </p>
                      <p className="text-xs text-text-muted">
                        #{e.position} {e.service && `· ${e.service.name}`} · {e.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {e.status === "WAITING" && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(e.id, "CALLED")}>
                          Call
                        </Button>
                      )}
                      {e.status === "CALLED" && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(e.id, "IN_PROGRESS")}>
                          Start
                        </Button>
                      )}
                      {e.status === "IN_PROGRESS" && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(e.id, "COMPLETED")}>
                          Complete
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(e.id, "NO_SHOW")}>
                        No-show
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <p className="text-sm text-text-secondary">Create a queue to get started.</p>
        )}
      </div>
    </div>
  );
}
