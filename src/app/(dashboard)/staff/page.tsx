"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/staff");
    const data = await res.json();
    setStaff(data.staff ?? []);
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
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    setSubmitting(false);
    if (res.ok) {
      setName("");
      setRole("");
      load();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Staff" description="Manage your team members and their roles." />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Role" required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Stylist" />
            <div className="flex items-end">
              <Button type="submit" loading={submitting} className="w-full">
                Add staff
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-text-secondary">No staff yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => (
              <Card key={s.id} className="p-4">
                <h3 className="font-semibold text-text">{s.name}</h3>
                <p className="text-sm text-primary">{s.role}</p>
                <div className="mt-2 text-xs text-text-muted">
                  {s.phone && <p>{s.phone}</p>}
                  {s.email && <p>{s.email}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
