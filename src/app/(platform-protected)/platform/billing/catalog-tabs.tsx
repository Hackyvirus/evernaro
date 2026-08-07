"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Layers, Package, Tag, Percent, ReceiptIndianRupee } from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceInr: number;
  annualPriceInr: number;
  trialDays: number;
  isActive: boolean;
  isCustom: boolean;
  _count: { subscriptions: number };
}

interface Service {
  id: string;
  key: string;
  name: string;
  category: string;
  unit: string;
  billingType: string;
  basePriceInr: number;
}

interface AddOn {
  id: string;
  slug: string;
  name: string;
  priceInr: number;
  frequency: string;
  minQuantity: number;
  maxQuantity: number | null;
  isActive: boolean;
}

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
}

interface TaxConfig {
  name: string;
  rate: number;
  inclusive: boolean;
}

const TABS = [
  { id: "plans", label: "Plans", icon: Layers },
  { id: "services", label: "Services", icon: Package },
  { id: "addOns", label: "Add-ons", icon: Tag },
  { id: "coupons", label: "Coupons", icon: Percent },
  { id: "tax", label: "Tax", icon: ReceiptIndianRupee },
];

interface Props {
  plans: Plan[];
  services: Service[];
  addOns: AddOn[];
  coupons: Coupon[];
  tax: TaxConfig | null;
}

export function BillingCatalogTabs({ plans, services, addOns, coupons, tax }: Props) {
  const [tab, setTab] = useState("plans");
  const [saving, setSaving] = useState(false);

  async function saveTax(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/platform/billing/tax", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        rate: Number(form.get("rate")),
        inclusive: form.get("inclusive") === "on",
      }),
    });
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border">
        <nav aria-label="Tabs" className="flex gap-6 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:text-text"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "plans" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-text">{plan.name}</h3>
                  <p className="text-xs text-text-secondary">{plan.slug}</p>
                </div>
                <Badge variant={plan.isActive ? "success" : "default"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{plan.description}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span>₹{plan.monthlyPriceInr.toLocaleString("en-IN")}/mo</span>
                <span>₹{plan.annualPriceInr.toLocaleString("en-IN")}/yr</span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{plan._count.subscriptions} active subscriptions</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "services" && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-start text-xs uppercase">Key</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Name</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Category</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Unit</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Type</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Base price</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{svc.key}</td>
                  <td className="px-3 py-2">{svc.name}</td>
                  <td className="px-3 py-2">{svc.category}</td>
                  <td className="px-3 py-2">{svc.unit}</td>
                  <td className="px-3 py-2">{svc.billingType}</td>
                  <td className="px-3 py-2">₹{svc.basePriceInr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "addOns" && (
        <div className="grid gap-4 md:grid-cols-2">
          {addOns.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-text">{a.name}</h3>
                <Badge variant={a.isActive ? "success" : "default"}>{a.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-sm text-text-secondary">{a.slug}</p>
              <p className="mt-2 text-sm">₹{a.priceInr.toLocaleString("en-IN")}/{a.frequency.toLowerCase()}</p>
              <p className="text-xs text-text-muted">Qty: {a.minQuantity}-{a.maxQuantity ?? "∞"}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "coupons" && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-start text-xs uppercase">Code</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Type</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Value</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Redemptions</th>
                <th className="px-3 py-2 text-start text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2">{c.type}</td>
                  <td className="px-3 py-2">{c.type === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}</td>
                  <td className="px-3 py-2">{c.redemptionCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-3 py-2"><Badge variant={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tax" && tax && (
        <Card className="max-w-md p-5">
          <form onSubmit={saveTax} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary">Tax name</label>
              <Input name="name" defaultValue={tax.name} required />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Rate (%)</label>
              <Input name="rate" type="number" step="0.01" defaultValue={tax.rate} required />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input name="inclusive" type="checkbox" defaultChecked={tax.inclusive} />
              Tax inclusive
            </label>
            <Button type="submit" loading={saving}>Save tax config</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
