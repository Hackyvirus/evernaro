"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui";
import { Receipt, Wallet, AlertCircle, Sparkles, CreditCard, RotateCcw } from "lucide-react";
import { RoleAwareAdminGuard } from "../role";
import Link from "next/link";

interface LatestInvoice {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  amountInr: number;
  createdAt: string;
  paidAt: string | null;
}

interface Invoice {
  id: string;
  amountInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  razorpayOrderId: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface WalletData {
  id: string;
  balancePaise: number;
  lowBalanceThresholdPaise: number;
}

interface WalletTx {
  id: string;
  type: "TOPUP" | "MESSAGE_DEBIT" | "REFUND" | "MANUAL_CREDIT" | "MANUAL_DEBIT";
  amountPaise: number;
  note: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: string;
  frequency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  totalAmountInr: number;
  plan: {
    name: string;
    description: string | null;
    features: { key: string; label: string; value: string | null; included: boolean }[];
    limits: { service: { key: string; name: string; unit: string }; includedQuantity: number }[];
  };
  items: { addOn: { name: string } | null; quantity: number; totalPriceInr: number }[];
}

interface UsageItem {
  serviceName: string;
  unit: string;
  included: number;
  used: number;
  remaining: number;
  overage: number;
  overageCostInr: number;
  percentUsed: number;
}

interface Payment {
  id: string;
  amountInr: number;
  status: "PAID" | "FAILED" | "PENDING" | "REFUNDED";
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  failureReason: string | null;
  createdAt: string;
  invoice: { id: string; type: "SUBSCRIPTION" | "WALLET_TOPUP" } | null;
  subscription: { id: string; plan: { name: string } } | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function statusVariant(status: Invoice["status"] | Payment["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED" || status === "REFUNDED") return "default";
  return "warning";
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TX_LABEL: Record<WalletTx["type"], string> = {
  TOPUP: "Top-up",
  MESSAGE_DEBIT: "WhatsApp message",
  REFUND: "Refund",
  MANUAL_CREDIT: "Manual credit",
  MANUAL_DEBIT: "Manual debit",
};

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

async function payInvoice(
  invoice: { id: string; amountInr: number; razorpayOrderId: string | null },
  description: string,
  onSettled: (error: string | null) => void
) {
  if (!invoice.razorpayOrderId) return;
  try {
    await loadRazorpayScript();
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId || !window.Razorpay) {
      onSettled("Online payment isn't set up yet — contact support.");
      return;
    }
    const checkout = new window.Razorpay({
      key: razorpayKeyId,
      order_id: invoice.razorpayOrderId,
      amount: invoice.amountInr * 100,
      currency: "INR",
      name: "Evernaro",
      description,
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
            onSettled(data.error ?? "Payment succeeded but confirmation failed — contact support.");
            return;
          }
          onSettled(null);
        } catch {
          onSettled("Payment succeeded but confirmation failed — contact support.");
        }
      },
      modal: { ondismiss: () => onSettled(null) },
    });
    checkout.open();
  } catch {
    onSettled("Couldn't open the payment window — check your connection and try again.");
  }
}

export default function BillingPage() {
  return (
    <RoleAwareAdminGuard>
      <BillingPageContent />
    </RoleAwareAdminGuard>
  );
}

function BillingPageContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [latestInvoice, setLatestInvoice] = useState<LatestInvoice | null>(null);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [topupAmount, setTopupAmount] = useState("1000");
  const [toppingUp, setToppingUp] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  function refresh() {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .finally(() => setLoaded(true));
    fetch("/api/organization")
      .then((r) => r.json())
      .then((d) => {
        setLatestInvoice(d.latestSubscriptionInvoice ?? null);
      });
    fetch("/api/billing/subscription")
      .then((r) => r.json())
      .then((d) => {
        setSubscription(d.subscription ?? null);
        setSubscriptionLoading(false);
      })
      .catch(() => setSubscriptionLoading(false));
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d.usage ?? []));
    fetch("/api/billing/payments")
      .then((r) => r.json())
      .then((d) => {
        setPayments(d.payments ?? []);
        setPaymentsLoaded(true);
      })
      .catch(() => setPaymentsLoaded(true));
  }

  function refreshWallet() {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => setWallet(d.wallet ?? null));
    fetch("/api/wallet/transactions")
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []));
  }

  useEffect(() => {
    refresh();
    refreshWallet();
  }, []);

  async function pay(invoice: Invoice) {
    setError(null);
    setPayingId(invoice.id);
    await payInvoice(invoice, "Subscription payment", (err) => {
      setError(err);
      setPayingId(null);
      refresh();
    });
  }

  async function topUp() {
    setWalletError(null);
    const amountInr = Number(topupAmount);
    if (!Number.isInteger(amountInr) || amountInr < 500 || amountInr > 100000) {
      setWalletError("Enter an amount between ₹500 and ₹1,00,000");
      return;
    }
    setToppingUp(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWalletError(data.error ?? "Failed to start top-up");
        setToppingUp(false);
        return;
      }
      await payInvoice(data.invoice, "WhatsApp wallet top-up", (err) => {
        setWalletError(err);
        setToppingUp(false);
        refreshWallet();
      });
    } catch {
      setWalletError("Failed to start top-up");
      setToppingUp(false);
    }
  }

  async function cancelSubscription() {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtPeriodEnd: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  async function reactivateSubscription() {
    setReactivating(true);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reactivate");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setReactivating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Billing"
        description="Your invoices, WhatsApp wallet, and payment history."
      />

      <div className="flex flex-col gap-6 p-6">
        {latestInvoice && latestInvoice.status === "PENDING" && (
          <Card className="flex flex-col items-center gap-3 border border-warning bg-warning-light p-4 text-center sm:flex-row sm:items-start sm:text-start">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text">Subscription payment pending</p>
              <p className="text-xs text-text-secondary">
                Invoice of ₹{latestInvoice.amountInr.toLocaleString("en-IN")} is due. Pay now to keep campaigns, reminders, and outbound messages running.
              </p>
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col justify-between p-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-bold text-text">Current plan</h2>
              </div>
              {subscriptionLoading ? (
                <Skeleton className="h-16" />
              ) : subscription ? (
                <>
                  <div className="mb-3 flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-text">{subscription.plan.name}</p>
                    <Badge variant={subscription.status === "ACTIVE" || subscription.status === "TRIALING" ? "success" : "warning"}>
                      {subscription.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary">
                    ₹{subscription.totalAmountInr.toLocaleString("en-IN")}/{subscription.frequency.toLowerCase()}
                  </p>
                  {subscription.trialEnd && (
                    <p className="mt-1 text-xs text-text-muted">
                      Trial ends {new Date(subscription.trialEnd).toLocaleDateString()}
                    </p>
                  )}
                  {subscription.cancelAtPeriodEnd && (
                    <p className="mt-1 text-xs text-danger">Cancels at period end</p>
                  )}
                  {subscription.items.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {subscription.items.map((item) => (
                        <li key={item.addOn?.name} className="text-xs text-text-secondary">
                          {item.addOn?.name} x{item.quantity} — ₹{item.totalPriceInr.toLocaleString("en-IN")}
                        </li>
                      ))}
                    </ul>
                  )}
                  {subscription.plan.features.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-1.5">
                      {subscription.plan.features
                        .filter((f) => f.included)
                        .slice(0, 6)
                        .map((f) => (
                          <li key={f.key} className="flex items-start gap-2 text-xs text-text-secondary">
                            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                            {f.label}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-extrabold text-text">No active plan</p>
                  <p className="text-sm text-text-secondary">Subscribe to unlock more features.</p>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/billing/plans"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {subscription ? "Change plan" : "Choose a plan"}
              </Link>
              {subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING" || subscription.status === "INCOMPLETE") && !subscription.cancelAtPeriodEnd && (
                <Button variant="danger" size="sm" loading={cancelling} onClick={cancelSubscription}>Cancel subscription</Button>
              )}
              {subscription && subscription.cancelAtPeriodEnd && (
                <Button variant="secondary" size="sm" loading={reactivating} onClick={reactivateSubscription}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Keep subscription
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text">WhatsApp wallet</h2>
            </div>
            {!wallet ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <p className="text-3xl font-extrabold text-text tabular-nums">{formatPaise(wallet.balancePaise)}</p>
                {wallet.balancePaise <= wallet.lowBalanceThresholdPaise && (
                  <p className="mt-1 text-xs text-warning">
                    Balance is at or below your alert threshold ({formatPaise(wallet.lowBalanceThresholdPaise)}) —
                    WhatsApp sends will stop once it reaches zero.
                  </p>
                )}
                {walletError && <p className="mt-3 text-sm text-danger">{walletError}</p>}
                <div className="mt-4 flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="topup-amount" className="text-xs font-medium text-text-secondary">
                      Top up (₹)
                    </label>
                    <Input
                      id="topup-amount"
                      type="number"
                      min={500}
                      max={100000}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button loading={toppingUp} onClick={topUp}>
                    Top up
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>

        {usage.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-text">Usage this period</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {usage.map((u) => (
                <div key={u.serviceName} className="rounded-lg bg-surface-secondary p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text">{u.serviceName}</p>
                    <span className="text-xs text-text-secondary">{u.percentUsed}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-border">
                    <div
                      className={`h-2 rounded-full ${u.percentUsed >= 90 ? "bg-danger" : u.percentUsed >= 70 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${u.percentUsed}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {u.used.toLocaleString("en-IN")} / {u.included.toLocaleString("en-IN")} {u.unit}
                    {u.overage > 0 && <span className="ml-2 text-danger">+{u.overage} ({formatPaise(u.overageCostInr * 100)})</span>}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {transactions.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-text">Recent wallet transactions</h2>
            <ul className="flex flex-col gap-2">
              {transactions.slice(0, 10).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-text">{TX_LABEL[tx.type]}</p>
                    {tx.note && <p className="text-xs text-text-muted">{tx.note}</p>}
                  </div>
                  <span className={tx.amountPaise >= 0 ? "text-success tabular-nums" : "text-text-secondary tabular-nums"}>
                    {tx.amountPaise >= 0 ? "+" : ""}
                    {formatPaise(tx.amountPaise)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-sm font-bold text-text">Subscription invoices</h2>
          {error && <p className="mb-4 text-sm text-danger">{error}</p>}
          {!loaded ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices yet" description="Invoices from Eversity will show up here." />
          ) : (
            <ul className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Card className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

        <div>
          <h2 className="mb-3 text-sm font-bold text-text">Payment history</h2>
          {!paymentsLoaded ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here once a subscription invoice is paid." />
          ) : (
            <ul className="flex flex-col gap-2">
              {payments.map((p) => (
                <li key={p.id}>
                  <Card className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-text">₹{p.amountInr.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-text-secondary">
                        {p.razorpayPaymentId ? `Payment ${p.razorpayPaymentId}` : "Payment"} ·{" "}
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
