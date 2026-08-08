"use client";

import { useEffect, useState } from "react";
import { Button, Card, Skeleton, Badge } from "@/components/ui";
import { Check, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";


function FrequencyToggle({ value, onChange }: { value: "MONTHLY" | "YEARLY"; onChange: (v: "MONTHLY" | "YEARLY") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      {(["MONTHLY", "YEARLY"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            value === f ? "bg-primary text-white" : "text-text-secondary hover:text-text"
          }`}
        >
          {f === "MONTHLY" ? "Monthly" : "Yearly"}
        </button>
      ))}
    </div>
  );
}

interface PlanLimit {
  serviceKey: string;
  serviceName: string;
  unit: string;
  includedQuantity: number;
  overagePriceInr: number | null;
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

interface PlanFeature {
  id: string;
  key: string;
  label: string;
  value: string | null;
  included: boolean;
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
  limits: PlanLimit[];
  addOns: PlanAddOn[];
}

function formatPrice(amount: number, currency: string) {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function PricingPage() {
  const { status: sessionStatus } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((r) => r.json())
      .then((d) => {
        setPlans(d.plans ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function getQuote(plan: Plan) {
    if (sessionStatus !== "authenticated") return;
    setQuoting(true);
    setSelectedPlan(plan);
    setError(null);
    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ addOnId: id, quantity }));
      const res = await fetch("/api/billing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, frequency, addOns, couponCode: couponCode || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to calculate quote");
      setQuote(data.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate quote");
    } finally {
      setQuoting(false);
    }
  }

  async function subscribe() {
    if (!selectedPlan) return;
    setSubscribing(true);
    setError(null);
    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ addOnId: id, quantity }));
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan.id, frequency, addOns, couponCode: couponCode || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start subscription");
      setSuccess("Subscription started. You can manage it from your billing dashboard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start subscription");
    } finally {
      setSubscribing(false);
    }
  }

  function updateAddOn(addOnId: string, quantity: number, max: number | null) {
    const qty = Math.max(0, Math.min(quantity, max ?? Infinity));
    setSelectedAddOns((prev) => ({ ...prev, [addOnId]: qty }));
    if (selectedPlan) {
      // debounce quote refresh
      window.clearTimeout((updateAddOn as unknown as { _t?: number })._t);
      (updateAddOn as unknown as { _t?: number })._t = window.setTimeout(() => getQuote(selectedPlan), 300);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-lg font-bold text-text">Evernaro</Link>
          <div className="flex items-center gap-4">
            {sessionStatus === "authenticated" ? (
              <Link href="/dashboard" className="text-sm text-text-secondary hover:text-text">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-text-secondary hover:text-text">Log in</Link>
                  <Link href="/signup" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-text">Simple, transparent pricing</h1>
          <p className="mt-2 text-text-secondary">Choose a plan that fits your business. Upgrade or downgrade anytime.</p>
          <div className="mt-6 flex justify-center">
            <FrequencyToggle
              value={frequency}
              onChange={(id) => {
                setFrequency(id);
                if (selectedPlan) getQuote(selectedPlan);
              }}
            />
          </div>
        </div>

        {error && <p className="mb-6 text-center text-sm text-danger">{error}</p>}
        {success && <p className="mb-6 text-center text-sm text-success">{success}</p>}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const price = frequency === "YEARLY" ? plan.annualPriceInr : plan.monthlyPriceInr;
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={`flex flex-col p-6 ${isSelected ? "ring-2 ring-primary" : ""} ${plan.slug === "growth" ? "border-primary" : ""}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text">{plan.name}</h2>
                    {plan.slug === "growth" && <Badge variant="primary"><Sparkles className="mr-1 h-3 w-3" /> Popular</Badge>}
                  </div>
                  <p className="text-sm text-text-secondary">{plan.description}</p>
                  <div className="my-4">
                    <span className="text-3xl font-extrabold text-text">{formatPrice(price, plan.currency)}</span>
                    <span className="text-sm text-text-secondary">/{frequency === "YEARLY" ? "year" : "month"}</span>
                  </div>

                  <ul className="mb-6 flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f.id} className="flex items-start gap-2 text-sm text-text-secondary">
                        <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${f.included ? "text-success" : "text-text-muted"}`} />
                        <span className={f.included ? "" : "line-through opacity-60"}>{f.label}{f.value ? `: ${f.value}` : ""}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.addOns.length > 0 && (
                    <div className="mb-4 flex flex-col gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Add-ons</p>
                      {plan.addOns.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2">
                          <label className="text-sm text-text-secondary">{a.name}</label>
                          <input
                            type="number"
                            min={0}
                            max={a.maxQuantity ?? undefined}
                            value={selectedAddOns[a.id] ?? 0}
                            onChange={(e) => updateAddOn(a.id, Number(e.target.value), a.maxQuantity)}
                            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {sessionStatus === "authenticated" ? (
                    <div className="mt-auto flex flex-col gap-2">
                      <Button
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => getQuote(plan)}
                        disabled={quoting && isSelected}
                        className="w-full"
                      >
                        {quoting && isSelected ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSelected ? "Update quote" : "Select plan"}
                      </Button>
                      {isSelected && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                          />
                          {quote && (
                            <div className="rounded-lg bg-surface-secondary p-3 text-sm">
                              <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(quote.subtotalInr).toLocaleString("en-IN")}</span></div>
                              {Number(quote.discountAmountInr) > 0 && (
                                <div className="flex justify-between text-success"><span>Discount</span><span>-₹{Number(quote.discountAmountInr).toLocaleString("en-IN")}</span></div>
                              )}
                              <div className="flex justify-between"><span>Tax</span><span>₹{Number(quote.taxAmountInr).toLocaleString("en-IN")}</span></div>
                              <div className="flex justify-between font-bold"><span>Total</span><span>₹{Number(quote.totalInr).toLocaleString("en-IN")}</span></div>
                              <Button className="mt-3 w-full" loading={subscribing} onClick={subscribe}>Subscribe</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href="/signup"
                      className={`mt-auto inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                        plan.slug === "growth"
                          ? "bg-primary text-white hover:bg-primary-hover"
                          : "border border-border bg-card text-text hover:bg-surface"
                      }`}
                    >
                      Get started
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
