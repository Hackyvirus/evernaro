"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { useRole, isAdmin } from "../role";

 type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number | null;
  priceInr: number | null;
  color: string | null;
};

export default function ServicesPage() {
  const role = useRole();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [priceInr, setPriceInr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/services");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load services");
      setServices(data.services ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
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
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          durationMin: durationMin ? Number(durationMin) : undefined,
          priceInr: priceInr ? Number(priceInr) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add service");
      setName("");
      setDurationMin("");
      setPriceInr("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Services" description="Manage the services your business offers." />

      <div className="flex flex-1 flex-col gap-6 p-6">
      {error && <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      {isAdmin(role) && (
        <Card className="p-4">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-4">
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Duration (min)"
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
            <Input
              label="Price (₹)"
              type="number"
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" loading={submitting} className="w-full">
                Add service
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-text-secondary">No services yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-center gap-2">
                {s.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />}
                <h3 className="font-semibold text-text">{s.name}</h3>
              </div>
              {s.description && <p className="mt-1 text-sm text-text-secondary">{s.description}</p>}
              <div className="mt-3 flex gap-3 text-xs text-text-muted">
                {s.durationMin && <span>{s.durationMin} min</span>}
                {s.priceInr !== null && s.priceInr > 0 && <span>₹{s.priceInr}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
