"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type Appointment = {
  id: string;
  contact: { name: string | null; phone: string | null };
  service: { name: string } | null;
  staff: { name: string } | null;
  startsAt: string;
  endsAt: string;
  status: string;
};

type ContactOption = { id: string; name: string | null; phone: string | null };
type ServiceOption = { id: string; name: string };
type StaffOption = { id: string; name: string };

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactId, setContactId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [apptRes, contactRes, serviceRes, staffRes] = await Promise.all([
      fetch("/api/appointments?from=" + new Date().toISOString()),
      fetch("/api/contacts"),
      fetch("/api/services"),
      fetch("/api/staff"),
    ]);
    const apptData = await apptRes.json();
    const contactData = await contactRes.json();
    const serviceData = await serviceRes.json();
    const staffData = await staffRes.json();
    setAppointments(apptData.appointments ?? []);
    setContacts(contactData.contacts ?? []);
    setServices(serviceData.services ?? []);
    setStaff(staffData.staff ?? []);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + Number(duration) * 60000);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setContactId("");
      setServiceId("");
      setStaffId("");
      setStartsAt("");
      load();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Appointments" description="Book and manage appointments." />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Staff</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">Any</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Start"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Input
              label="Duration (min)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" loading={submitting} className="w-full">
                Book
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-text-secondary">No upcoming appointments.</p>
        ) : (
          <div className="grid gap-3">
            {appointments.map((a) => (
              <Card key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-text">{a.contact.name || a.contact.phone || "Unknown"}</p>
                  <p className="text-sm text-text-secondary">
                    {a.service?.name} {a.staff && `· ${a.staff.name}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(a.startsAt).toLocaleString()} - {new Date(a.endsAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="mt-2 inline-flex w-fit rounded-full bg-primary-lighter px-2.5 py-1 text-xs font-medium text-primary sm:mt-0">
                  {a.status}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
