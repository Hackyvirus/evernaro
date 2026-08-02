"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { Receipt } from "lucide-react";

interface Invoice {
  id: string;
  amountInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  razorpayOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function statusVariant(status: Invoice["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "warning";
}

let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoaded(true));
  }

  useEffect(refresh, []);

  async function pay(invoice: Invoice) {
    if (!invoice.razorpayOrderId) return;
    setError(null);
    setPayingId(invoice.id);
    try {
      await loadRazorpayScript();
      const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKeyId || !window.Razorpay) {
        setError("Online payment isn't set up yet — contact support.");
        setPayingId(null);
        return;
      }
      const checkout = new window.Razorpay({
        key: razorpayKeyId,
        order_id: invoice.razorpayOrderId,
        amount: invoice.amountInr * 100,
        currency: "INR",
        name: "EverReach",
        description: "Subscription payment",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const res = await fetch(`/api/invoices/${invoice.id}/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setError(data.error ?? "Payment succeeded but confirmation failed — contact support.");
            }
          } catch {
            setError("Payment succeeded but confirmation failed — contact support.");
          }
          setPayingId(null);
          refresh();
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      checkout.open();
    } catch {
      setError("Couldn't open the payment window — check your connection and try again.");
      setPayingId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text">Billing</h1>
        <p className="text-sm text-text-secondary">Your invoices and payment history.</p>
      </header>

      <div className="p-6">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        {!loaded ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Invoices from Eversity will show up here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Card className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">₹{inv.amountInr.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-text-secondary">
                      {inv.status === "PAID" && inv.paidAt
                        ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}`
                        : `Created ${new Date(inv.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                    {inv.status === "PENDING" && inv.razorpayOrderId && (
                      <Button size="sm" loading={payingId === inv.id} onClick={() => pay(inv)}>
                        Pay now
                      </Button>
                    )}
                    {inv.status === "PENDING" && !inv.razorpayOrderId && (
                      <span className="text-xs text-text-muted">Payment link pending</span>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
