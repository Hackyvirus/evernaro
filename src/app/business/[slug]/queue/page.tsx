"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Input, PageHeader } from "@/components/ui";

type Service = { id: string; name: string; durationMin: number | null; priceInr: number | null };
type Queue = { id: string; name: string; serviceId: string | null; service: Service | null };
type OrgInfo = { name: string; open: boolean; closedMessage: string };

export default function PublicQueueCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queueId, setQueueId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${slug}/queues`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Business not found");
        const data = await res.json();
        setOrg(data.org ?? null);
        setQueues(data.queues ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/public/${slug}/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId, name, phone, email: email || undefined, website: honeypot || undefined }),
    });

    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      // Redirect to the persistent tracker URL instead of showing an
      // in-place confirmation screen: that screen was pure in-memory React
      // state, so refreshing this page (easy to do by accident) wiped it
      // and dumped the customer back on the empty join form with no way to
      // recover their token unless they'd already tapped through to the
      // tracker first. The tracker page fetches by the token in its own
      // URL, so it survives a refresh correctly.
      router.push(`/business/${slug}/queue/${data.entry.publicToken}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not join queue. Please try again.");
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error && !org) return <div className="p-8 text-center text-danger">{error}</div>;

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-md">
        <PageHeader title={`Join queue at ${org?.name}`} description="Get in line without downloading an app." />

        <Card className="mt-6 p-6">
          {org && !org.open && (
            <div className="mb-4 rounded-lg bg-warning/10 p-4 text-center">
              <p className="font-medium text-warning">{org.closedMessage}</p>
              <p className="text-sm text-text-secondary">You can still register and we&apos;ll notify the business when they open.</p>
            </div>
          )}
          <form onSubmit={onSubmit} className="relative flex flex-col gap-4">
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
            <Input
              label="Email (optional)"
              type="email"
              hint="We'll notify you here too when it's your turn."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && <p className="text-sm text-danger">{error}</p>}

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

            <Button type="submit" loading={submitting} className="w-full">
              {org && !org.open ? "Register (business is closed)" : submitting ? "Joining..." : "Join Queue"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
