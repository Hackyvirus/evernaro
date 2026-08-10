"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { useRole, isAdmin } from "../role";

type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
};

export default function StaffPage() {
  const role = useRole();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load staff");
      setStaff(data.staff ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: staffRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add staff");
      setName("");
      setStaffRole("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add staff");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Staff" description="Manage your team members and their roles." />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {error && <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</div>}
        {isAdmin(role) && (
          <Card className="p-4">
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
              <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Role" required value={staffRole} onChange={(e) => setStaffRole(e.target.value)} placeholder="e.g. Stylist" />
              <div className="flex items-end">
                <Button type="submit" loading={submitting} className="w-full">
                  Add staff
                </Button>
              </div>
            </form>
          </Card>
        )}

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
