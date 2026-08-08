"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Skeleton, Badge, Input } from "@/components/ui";
import { Check, Loader2 } from "lucide-react";
import { RoleAwareAdminGuard } from "../../role";

interface PlanFeature {
  id: string;
  key: string;
  label: string;
  value: string | null;
  included: boolean;
}

interface PlanAddOn {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceInr: number;
  frequency: string;
  minQuantity: number;
  maxQuantity: number | null;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceInr: number;
  annualPriceInr: number;
  currency: string;
  trialDays: number;
  isCustom: boolean;
  features: PlanFeature[];
  addOns: PlanAddOn[];
}

interface QuoteAddOn {
  addOnId: string;
  name: string;
  quantity: number;
  unitPriceInr: number;
  amountInr: number;
}

interface Quote {
  planId: string;
  planName: string;
  frequency: "MONTHLY" | "YEARLY";
  baseAmountInr: number;
  addOns: QuoteAddOn[];
  discountAmountInr: number;
  subtotalInr: number;
  taxRate: number;
  taxAmountInr: number;
  taxInclusive: boolean;
  totalInr: number;
  currency: string;
  trialEnd: string | null;
}

interface Subscription {
  id: string;
  planId: string;
  frequency: "MONTHLY" | "YEARLY";
  status: string;
  totalAmountInr: number;
  plan: { name: string };
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function formatPrice(amount: number, currency: string) {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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

export default function BillingPlansPage() {
  return (
    <RoleAwareAdminGuard>
      <BillingPlansPageContent />
    </RoleAwareAdminGuard>
  );
}

function BillingPlansPageContent() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const [frequency, setFrequency] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [couponCode, setCouponCode] = useState("");
  const [prorate, setProrate] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/plans").then((r) => r.json()),
      fetch("/api/billing/subscription").then((r) => r.json()),
    ])
      .then(([plansData, subData]) => {
        const list = (plansData.plans ?? []).filter((p: Plan) => !p.isCustom);
        setPlans(list);
        setCurrentSubscription(subData.subscription ?? null);
        if (subData.subscription) {
          setSelectedPlanId(subData.subscription.planId);
          setFrequency(subData.subscription.frequency);
        } else if (list.length > 0) {
          setSelectedPlanId(list[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function updateAddOn(addOnId: string, quantity: number, max: number | null) {
    const qty = Math.max(0, Math.min(quantity, max ?? Infinity));
    setSelectedAddOns((prev) => {
      const next = { ...prev, [addOnId]: qty };
      return next;
    });
  }

  async function fetchQuote(planId: string, planFrequency: "MONTHLY" | "YEARLY" = frequency) {
    setQuoting(true);
    setError(null);
    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));
      const res = await fetch("/api/billing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          frequency: planFrequency,
          addOns,
          couponCode: couponCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to calculate quote");
      setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate quote");
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }

  async function openRazorpay(
    orderId: string,
    invoiceId: string,
    amountInr: number,
    description: string
  ) {
    await loadRazorpayScript();
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const Razorpay = window.Razorpay;
    if (!razorpayKeyId || !Razorpay) {
      throw new Error("Online payment isn't set up yet — contact support.");
    }
    return new Promise<void>((resolve, reject) => {
      const checkout = new Razorpay({
        key: razorpayKeyId,
        order_id: orderId,
        amount: amountInr * 100,
        currency: "INR",
        name: "Evernaro",
        description,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const res = await fetch(`/api/invoices/${invoiceId}/confirm`, {
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
              reject(new Error(data.error ?? "Payment confirmation failed"));
              return;
            }
            resolve();
          } catch {
            reject(new Error("Payment confirmation failed"));
          }
        },
        modal: { ondismiss: () => resolve() },
      });
      checkout.open();
    });
  }

  async function changePlan() {
    if (!selectedPlanId || !quote) return;
    setError(null);
    setSuccess(null);
    setChanging(true);

    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));

      const res = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change",
          planId: selectedPlanId,
          frequency,
          addOns,
          couponCode: couponCode || null,
          prorate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change plan");

      if (data.razorpayOrderId && data.invoice) {
        await openRazorpay(
          data.razorpayOrderId,
          data.invoice.id,
          data.quote.totalInr,
          `Evernaro ${data.quote.planName}`
        );
      }

      setSuccess("Plan updated successfully.");
      setTimeout(() => router.push("/billing"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change plan");
    } finally {
      setChanging(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold text-text">Change plan</h1>
          <p className="text-sm text-text-secondary">
            Choose a plan that fits your business. You can upgrade or downgrade anytime.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-6">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        {success && <p className="mb-4 text-sm text-success">{success}</p>}

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-lg border border-border bg-surface p-1">
            {(["MONTHLY", "YEARLY"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFrequency(f);
                  if (selectedPlanId) void fetchQuote(selectedPlanId, f);
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  frequency === f ? "bg-primary text-white" : "text-text-secondary hover:text-text"
                }`}
              >
                {f === "MONTHLY" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid gap-6 md:grid-cols-2">
              {plans.map((plan) => {
                const isCurrent = currentSubscription?.planId === plan.id;
                const price = frequency === "YEARLY" ? plan.annualPriceInr : plan.monthlyPriceInr;
                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col p-6 ${
                      selectedPlanId === plan.id ? "ring-2 ring-primary" : ""
                    } ${plan.slug === "growth" ? "border-primary" : ""}`}
                  >
                    {plan.slug === "growth" && (
                      <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                        Most popular
                      </span>
                    )}
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-text">{plan.name}</h2>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                    </div>
                    <p className="text-sm text-text-secondary">{plan.description}</p>
                    <div className="my-4">
                      <span className="text-3xl font-extrabold text-text">
                        {formatPrice(price, plan.currency)}
                      </span>
                      <span className="text-sm text-text-secondary">/{frequency === "YEARLY" ? "year" : "month"}</span>
                      {plan.trialDays > 0 && (
                        <p className="mt-1 text-xs text-success">{plan.trialDays}-day free trial</p>
                      )}
                    </div>

                    <ul className="mb-4 flex flex-1 flex-col gap-2">
                      {plan.features.map((f) => (
                        <li key={f.id} className="flex items-start gap-2 text-sm text-text-secondary">
                          <Check
                            className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                              f.included ? "text-primary" : "text-text-muted"
                            }`}
                          />
                          <span className={f.included ? "" : "line-through opacity-60"}>
                            {f.label}
                            {f.value ? `: ${f.value}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {plan.addOns.length > 0 && (
                      <div className="mb-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Add-ons</p>
                        {plan.addOns.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2">
                            <label className="text-sm text-text-secondary">{a.name}</label>
                            <input
                              type="number"
                              min={0}
                              max={a.maxQuantity ?? undefined}
                              value={selectedAddOns[a.id] ?? 0}
                              onChange={(e) => {
                                updateAddOn(a.id, Number(e.target.value), a.maxQuantity);
                                if (selectedPlanId) void fetchQuote(selectedPlanId);
                              }}
                              className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant={selectedPlanId === plan.id ? "primary" : "secondary"}
                      className="w-full"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        void fetchQuote(plan.id);
                      }}
                    >
                      {selectedPlanId === plan.id ? "Selected" : "Select plan"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <Card className="sticky top-24 p-5">
              <h3 className="mb-4 text-base font-bold text-text">Order summary</h3>
              {quoting ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating...
                </div>
              ) : quote ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{quote.planName}</span>
                    <span className="font-medium text-text">₹{quote.baseAmountInr.toLocaleString("en-IN")}</span>
                  </div>
                  {quote.addOns.map((a) => (
                    <div key={a.addOnId} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">
                        {a.name} x{a.quantity}
                      </span>
                      <span className="font-medium text-text">₹{a.amountInr.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  {quote.discountAmountInr > 0 && (
                    <div className="flex items-center justify-between text-sm text-success">
                      <span>Discount</span>
                      <span>-₹{quote.discountAmountInr.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {!quote.taxInclusive && quote.taxAmountInr > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">GST ({quote.taxRate}%)</span>
                      <span className="font-medium text-text">₹{quote.taxAmountInr.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between text-base font-bold text-text">
                      <span>Total</span>
                      <span>₹{quote.totalInr.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Coupon code</label>
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        if (selectedPlanId) void fetchQuote(selectedPlanId);
                      }}
                      placeholder="Optional"
                    />
                  </div>

                  {currentSubscription && currentSubscription.planId !== selectedPlanId && (
                    <label className="flex items-center gap-2 pt-1 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={prorate}
                        onChange={(e) => setProrate(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Prorate unused time from current plan
                    </label>
                  )}

                  <Button
                    loading={changing}
                    disabled={!quote || currentSubscription?.planId === selectedPlanId}
                    className="w-full"
                    onClick={changePlan}
                  >
                    {currentSubscription?.planId === selectedPlanId
                      ? "Current plan"
                      : quote.totalInr === 0
                        ? "Switch plan"
                        : "Pay & switch plan"}
                  </Button>

                  {quote.trialEnd && (
                    <p className="text-xs text-text-muted">
                      Your {new Date(quote.trialEnd).toLocaleDateString()} trial start will continue on the new plan.
                    </p>
                  )}

                  {currentSubscription && currentSubscription.planId !== selectedPlanId && (
                    <p className="text-xs text-text-muted">
                      Your current plan will be cancelled and the new plan starts immediately.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Select a plan to see pricing.</p>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
