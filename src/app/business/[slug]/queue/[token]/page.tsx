"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

type QueueStatus = {
  token: string;
  publicToken: string;
  status: string;
  isAfterHours?: boolean;
  position: number;
  ahead: number;
  estimatedWaitMin: number | null;
  queue: { id: string; name: string };
  verificationCode: string | null;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
};

export default function PublicQueueTrackerPage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelPhone, setCancelPhone] = useState("");

  const refresh = useCallback(() => {
    return fetch(`/api/public/queue/${token}/status`)
      .then((res) => {
        if (!res.ok) throw new Error("Entry not found");
        return res.json();
      })
      .then((data) => {
        setStatus(data.status as QueueStatus);
        // A single failed poll (transient network blip, cold-start timeout)
        // used to leave `error` set forever, since nothing ever cleared it
        // on a later successful poll -- the page rendered "Entry not found"
        // permanently even once fresh data was arriving every 5 seconds,
        // until a full page reload reset component state from scratch.
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load queue status"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [token, refresh]);

  async function cancel() {
    setCancelling(true);
    setError(null);
    const res = await fetch(`/api/public/queue/${token}/status`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cancelPhone }),
    });
    setCancelling(false);
    if (res.ok) {
      setShowCancelConfirm(false);
      await refresh();
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

        {isCalled && status.verificationCode && (
          <div className="mb-6 rounded-lg border-2 border-dashed border-warning bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning">Show this code to staff:</p>
            <p className="text-3xl font-bold tracking-widest text-text">{status.verificationCode}</p>
          </div>
        )}

        {status.isAfterHours && status.status === "WAITING" && (
          <div className="mb-6 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            This is an after-hours request. The business will be notified when they open.
          </div>
        )}

        {isInProgress && <p className="mb-6 text-sm font-medium text-success">You are being served.</p>}

        {isDone && <p className="mb-6 text-sm text-text-secondary">This queue session has ended.</p>}

        {!isDone && !showCancelConfirm && (
          <Button variant="ghost" onClick={() => setShowCancelConfirm(true)} className="w-full">
            Leave queue
          </Button>
        )}

        {!isDone && showCancelConfirm && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <p className="text-sm text-text-secondary">
              Enter the phone number you joined with to leave the queue.
            </p>
            <Input
              label="Phone number"
              type="tel"
              value={cancelPhone}
              onChange={(e) => setCancelPhone(e.target.value)}
              placeholder="Your phone number"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowCancelConfirm(false)} className="flex-1">
                Back
              </Button>
              <Button variant="danger" loading={cancelling} onClick={cancel} className="flex-1">
                Leave queue
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
