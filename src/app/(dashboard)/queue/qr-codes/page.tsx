"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Card, PageHeader } from "@/components/ui";

type Queue = { id: string; name: string };

export default function QueueQrCodesPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/queue")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load queues");
        const data = await res.json();
        setQueues(data.queues ?? []);
        setOrgSlug(data.orgSlug ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, []);

  function downloadQr(queueId: string, name: string) {
    const svg = document.getElementById(`qr-${queueId}`)?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "-").toLowerCase()}-queue-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-danger">{error}</div>;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader title="Queue QR Codes" description="Print or display these codes so customers can join a queue themselves." />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {queues.length === 0 ? (
          <p className="text-sm text-text-secondary">Create a queue first to generate QR codes.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {queues.map((q) => {
              const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/business/${orgSlug}/queue`;
              return (
                <Card key={q.id} className="flex flex-col items-center p-6 text-center">
                  <h3 className="mb-4 font-semibold text-text">{q.name}</h3>
                  <div id={`qr-${q.id}`} className="rounded-lg border border-border p-3">
                    <QRCodeSVG value={publicUrl} size={180} />
                  </div>
                  <p className="mt-3 break-all text-xs text-text-muted">{publicUrl}</p>
                  <Button size="sm" variant="secondary" className="mt-4" onClick={() => downloadQr(q.id, q.name)}>
                    Download SVG
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
