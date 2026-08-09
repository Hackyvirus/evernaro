"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { toZonedISO } from "@/lib/timezone";

type Service = { id: string; name: string; durationMin: number | null; priceInr: number | null; description: string | null };
type Staff = { id: string; name: string; role: string | null };

type OrgInfo = { name: string; open: boolean; closedMessage: string; timezone?: string };

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${slug}/services`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Business not found");
        const data = await res.json();
        setOrg(data.org ?? null);
        setServices(data.services ?? []);
        setStaffList(data.staff ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (honeypot) {
      setSubmitting(false);
      return;
    }

    const startsAt = org?.timezone
      ? toZonedISO(date, time, org.timezone)
      : new Date(`${date}T${time}`).toISOString();
    const res = await fetch(`/api/public/${slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        staffId: staffId || undefined,
        startsAt,
        name,
        phone,
        email: email || undefined,
        notes: notes || undefined,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Booking failed. Please try again.");
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error && !org) return <div className="p-8 text-center text-danger">{error}</div>;

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-text">Booking Confirmed</h1>
          <p className="text-text-secondary">Thank you, {name}. Your appointment at {org?.name} has been requested.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={`Book at ${org?.name}`} description="Select a service and time that works for you." />

        <Card className="mt-6 p-6">
          {org && !org.open && (
            <div className="mb-4 rounded-lg bg-warning/10 p-4 text-center">
              <p className="font-medium text-warning">{org.closedMessage}</p>
              <p className="text-sm text-text-secondary">You can still book an appointment for a future time.</p>
            </div>
          )}
          <form onSubmit={onSubmit} className="relative flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Service</label>
              <select
                required
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">Choose a service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.durationMin ? `(${s.durationMin} min)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Staff (optional)</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">Any available</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  min={
                    org?.timezone
                      ? new Date().toLocaleDateString("en-CA", { timeZone: org.timezone })
                      : new Date().toISOString().split("T")[0]
                  }
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">Time</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </div>
            </div>

            <Input label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              />
            </div>

            <div className="absolute -left-[9999px] top-0">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
            </div>

            {org?.timezone && (
              <p className="text-xs text-text-secondary">Times are shown in {org.timezone}.</p>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Booking..." : "Request Appointment"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
