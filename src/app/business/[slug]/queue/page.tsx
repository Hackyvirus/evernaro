"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type Service = { id: string; name: string; durationMin: number | null; priceInr: number | null };
type Queue = { id: string; name: string; serviceId: string | null; service: Service | null };
type Entry = {
  id: string;
  token: string;
  publicToken: string;
  verificationCode: string;
  position: number;
  estimatedWaitMin: number | null;
  queue: { id: string; name: string };
};

export default function PublicQueueCheckInPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [orgName, setOrgName] = useState("");
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [queueId, setQueueId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${slug}/queues`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Business not found");
        const data = await res.json();
        setOrgName(data.org?.name ?? "");
        setQueues(data.queues ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/public/${slug}/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId, name, phone }),
    });

    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setEntry(data.entry);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not join queue. Please try again.");
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error && !orgName) return <div className="p-8 text-center text-danger">{error}</div>;

  if (entry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-text">You&apos;re in line</h1>
          <p className="mb-6 text-text-secondary">
            {entry.queue.name} at {orgName}
          </p>

          <div className="mb-6 rounded-lg bg-primary/10 py-6">
            <div className="text-sm text-text-secondary">Your token</div>
            <div className="text-4xl font-bold text-primary">{entry.token}</div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-text-secondary">Position</div>
              <div className="text-2xl font-semibold text-text">#{entry.position}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-text-secondary">Est. wait</div>
              <div className="text-2xl font-semibold text-text">
                {entry.estimatedWaitMin ?? 0} min
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-warning p-4">
            <div className="text-xs text-text-secondary">Verification code</div>
            <div className="text-3xl font-bold tracking-widest text-warning">{entry.verificationCode}</div>
            <p className="mt-1 text-xs text-text-secondary">Show this to staff when your turn arrives.</p>
          </div>

          <a
            href={`/business/${slug}/queue/${entry.publicToken}`}
            className="inline-block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            Open live tracker
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={`Join queue at ${orgName}`} description="Get in line without downloading an app." />

        <Card className="mt-6 p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Queue</label>
              <select
                required
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">Select a queue</option>
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>

            <Input label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Joining..." : "Join Queue"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
