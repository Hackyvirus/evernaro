"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card } from "@/components/ui";

type QueueStatus = {
  token: string;
  publicToken: string;
  status: string;
  position: number;
  ahead: number;
  estimatedWaitMin: number | null;
  queue: { id: string; name: string };
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
};

export default function PublicQueueTrackerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const token = params.token as string;

  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/public/queue/${token}/status`);
      if (!res.ok) throw new Error("Entry not found");
      const data = await res.json();
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load queue status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [token]);

  async function cancel() {
    if (!confirm("Leave the queue? This cannot be undone.")) return;
    setCancelling(true);
    const res = await fetch(`/api/public/queue/${token}/status`, { method: "DELETE" });
    setCancelling(false);
    if (res.ok) {
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not cancel");
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !status) return <div className="p-8 text-center text-danger">{error ?? "Entry not found"}</div>;

  const isDone = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(status.status);
  const isCalled = status.status === "CALLED";
  const isInProgress = status.status === "IN_PROGRESS";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <Card className="w-full max-w-md p-6 text-center">
        <h1 className="mb-1 text-xl font-semibold text-text">{status.queue.name}</h1>
        <p className="mb-6 text-sm text-text-secondary">Token {status.token}</p>

        <div className="mb-6 rounded-lg bg-primary/10 py-8">
          <div className="text-sm text-text-secondary">
            {isDone ? "Status" : isInProgress ? "Now serving" : isCalled ? "Please proceed" : "People ahead of you"}
          </div>
          <div className="text-5xl font-bold text-primary">
            {isDone
              ? status.status.toLowerCase().replace(/_/g, " ")
              : isInProgress
                ? "Now"
                : isCalled
                  ? "Go"
                  : status.ahead}
          </div>
        </div>

        {!isDone && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-text-secondary">Position</div>
              <div className="text-2xl font-semibold text-text">#{status.position}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-text-secondary">Est. wait</div>
              <div className="text-2xl font-semibold text-text">{status.estimatedWaitMin ?? 0} min</div>
            </div>
          </div>
        )}

        {isCalled && (
          <p className="mb-6 text-sm font-medium text-warning">
            Please see the staff. Your verification code is required.
          </p>
        )}

        {isInProgress && <p className="mb-6 text-sm font-medium text-success">You are being served.</p>}

        {isDone && <p className="mb-6 text-sm text-text-secondary">This queue session has ended.</p>}

        {!isDone && (
          <Button variant="ghost" loading={cancelling} onClick={cancel} className="w-full">
            Leave queue
          </Button>
        )}
      </Card>
    </div>
  );
}
