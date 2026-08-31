"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton, Badge } from "@/components/ui";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isPublicPlanSlug } from "@/lib/billing/public-plans";

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
}

function formatPrice(amount: number, currency: string) {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function PricingPage() {
  const { status: sessionStatus } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((r) => r.json())
      .then((d) => {
        setPlans((d.plans ?? []).filter((p: Plan) => !p.isCustom && isPublicPlanSlug(p.slug)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const highlighted = plan.slug === "growth";
              return (
                <Card
                  key={plan.id}
                  className={`relative flex h-full flex-col gap-5 p-6 ${
                    highlighted ? "border-primary shadow-[var(--shadow-elevated)]" : ""
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-base font-bold text-text">{plan.name}</h3>
                      {highlighted && <Badge variant="primary"><Sparkles className="mr-1 h-3 w-3" /> Popular</Badge>}
                    </div>
                    <p className="text-sm text-text-secondary">{plan.description}</p>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-text">
                      {formatPrice(plan.monthlyPriceInr, plan.currency)}
                      <span className="text-sm font-medium text-text-muted">/month</span>
                    </p>
                    {plan.annualPriceInr > 0 && (
                      <p className="text-xs text-text-muted">
                        {formatPrice(plan.annualPriceInr, plan.currency)}/year
                      </p>
                    )}
                    {plan.trialDays > 0 && (
                      <p className="mt-1 text-xs text-success">{plan.trialDays}-day free trial</p>
                    )}
                  </div>
                  <ul className="flex flex-1 flex-col gap-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.id}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <Check
                          className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                            feature.included ? "text-primary" : "text-text-muted"
                          }`}
                          aria-hidden="true"
                        />
                        <span className={feature.included ? "" : "line-through opacity-60"}>
                          {feature.label}
                          {feature.value ? `: ${feature.value}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={sessionStatus === "authenticated" ? "/billing/plans" : "/signup"}
                    className={`mt-auto inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      highlighted
                        ? "bg-primary text-white hover:bg-primary-hover"
                        : "border border-border bg-card text-text hover:bg-surface"
                    }`}
                  >
                    {sessionStatus === "authenticated" ? "Manage plan" : "Get started"}
                  </Link>
                </Card>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-text-muted">
          WhatsApp send costs billed separately at Meta&apos;s per-conversation rates, capped by your
          prepaid wallet. Need a custom plan?{" "}
          <a
            href="mailto:contact@evernaro.com"
            className="cursor-pointer text-primary hover:text-primary-hover"
          >
            Talk to us
          </a>
          .
        </p>
      </main>
    </div>
  );
}
