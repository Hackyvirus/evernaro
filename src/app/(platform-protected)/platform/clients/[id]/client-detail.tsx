"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { Badge, Button, Card, Input, Select, StatCard } from "@/components/ui";

interface Channel {
  id: string;
  type: string;
  isActive: boolean;
  telegramBotUsername: string | null;
  emailAddress: string | null;
  whatsappAppName: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
  twilioFromNumber: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  amountInr: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  createdAt: string;
  paidAt: string | null;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  monthlyFeeInr: number | null;
  industry: string | null;
  description: string | null;
  users: Array<{ id: string; name: string; email: string; role: string; createdAt: string }>;
  channels: Channel[];
  invoices: Invoice[];
  contactCount: number;
  conversationCount: number;
  campaignCount: number;
  reminderCount: number;
  lastActivityAt: string | null;
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

const TX_LABEL: Record<WalletTx["type"], string> = {
  TOPUP: "Top-up",
  MESSAGE_DEBIT: "WhatsApp message",
  REFUND: "Refund",
  MANUAL_CREDIT: "Manual credit",
  MANUAL_DEBIT: "Manual debit",
};

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function channelDetail(c: Channel): string {
  if (c.type === "TELEGRAM") return c.telegramBotUsername ? `@${c.telegramBotUsername}` : "—";
  if (c.type === "EMAIL") return c.emailAddress ?? "—";
  if (c.type === "WHATSAPP") return c.whatsappSourceNumber ? `${c.whatsappAppName} · ${c.whatsappSourceNumber}` : "—";
  if (c.type === "INSTAGRAM") return c.instagramUsername ? `@${c.instagramUsername}` : "—";
  if (c.type === "VOICE") return c.twilioFromNumber ?? "—";
  return "—";
}

function invoiceStatusVariant(status: Invoice["status"]): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "PAID") return "success";
  if (status === "FAILED") return "danger";
  if (status === "CANCELLED") return "default";
  return "warning";
}

export function ClientDetail({
  org,
  initialWallet,
  initialWalletTx,
  onRefresh,
}: {
  org: OrgDetail;
  initialWallet: WalletData | null;
  initialWalletTx: WalletTx[];
  onRefresh: () => void;
}) {
  const [fee, setFee] = useState(org.monthlyFeeInr?.toString() ?? "");
  const [savingFee, setSavingFee] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);

  const [wallet, setWallet] = useState<WalletData | null>(initialWallet);
  const [walletTx, setWalletTx] = useState<WalletTx[]>(initialWalletTx);
  const [threshold, setThreshold] = useState(
    initialWallet ? String(Math.round(initialWallet.lowBalanceThresholdPaise / 100)) : ""
  );
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [adjustAction, setAdjustAction] = useState<"credit" | "debit">("credit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);

  async function refreshWallet() {
    const res = await fetch(`/api/platform/organizations/${org.id}/wallet`);
    const d = await res.json().catch(() => ({}));
    if (d.wallet) {
      setWallet(d.wallet);
      setThreshold(String(Math.round(d.wallet.lowBalanceThresholdPaise / 100)));
    }
    setWalletTx(d.transactions ?? []);
  }

  async function saveThreshold() {
    setSavingThreshold(true);
    try {
      await fetch(`/api/platform/organizations/${org.id}/wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowBalanceThresholdPaise: Math.round(Number(threshold) * 100) }),
      });
      refreshWallet();
    } finally {
      setSavingThreshold(false);
    }
  }

  async function submitAdjustment() {
    setWalletMessage(null);
    const amountInr = Number(adjustAmount);
    if (!amountInr || amountInr <= 0 || !adjustNote.trim()) {
      setWalletMessage("Enter an amount and a note");
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: adjustAction, amountInr, note: adjustNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWalletMessage(data.error ?? "Failed to adjust wallet");
      } else {
        setAdjustAmount("");
        setAdjustNote("");
        setWalletMessage("Wallet updated");
        refreshWallet();
      }
    } catch {
      setWalletMessage("Network error — check your connection and try again.");
    }
    setAdjusting(false);
  }

  async function saveFee() {
    setSavingFee(true);
    try {
      await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyFeeInr: fee === "" ? null : Number(fee) }),
      });
      onRefresh();
    } catch {
      // best-effort
    } finally {
      setSavingFee(false);
    }
  }

  async function generateInvoice() {
    setInvoicing(true);
    setInvoiceMessage(null);
    try {
      const res = await fetch(`/api/platform/organizations/${org.id}/invoices`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceMessage(data.error ?? "Failed to create invoice");
      } else if (data.warning) {
        setInvoiceMessage(data.warning);
      } else {
        setInvoiceMessage("Invoice created");
      }
      onRefresh();
    } catch {
      setInvoiceMessage("Network error — check your connection and try again.");
    }
    setInvoicing(false);
  }

  const owner = org.users.find((u) => u.role === "OWNER") ?? org.users[0];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <Link href="/platform" className="mx-auto mb-2 flex w-fit items-center gap-1.5 text-xs text-text-secondary hover:text-text sm:mx-0">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to clients
        </Link>
        <h1 className="text-xl font-bold text-text">{org.name}</h1>
        <p className="text-sm text-text-secondary">
          {org.slug} · Since {new Date(org.createdAt).toLocaleDateString()}
          {org.industry ? ` · ${org.industry}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Contacts" value={String(org.contactCount)} />
          <StatCard label="Conversations" value={String(org.conversationCount)} />
          <StatCard label="Campaigns" value={String(org.campaignCount)} />
          <StatCard label="Reminders" value={String(org.reminderCount)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-bold text-text">Owner</h2>
            {owner ? (
              <div className="text-sm">
                <p className="text-text">{owner.name}</p>
                <p className="text-text-secondary">{owner.email}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {owner.role} · Joined {new Date(owner.createdAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No owner on file.</p>
            )}
            {org.description && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-text-secondary">Business description</p>
                <p className="mt-1 text-sm text-text-secondary">{org.description}</p>
              </div>
            )}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-secondary">
                Last activity:{" "}
                {org.lastActivityAt ? new Date(org.lastActivityAt).toLocaleString() : "No activity yet"}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-bold text-text">Channels</h2>
            {org.channels.length === 0 ? (
              <p className="text-sm text-text-muted">No channels connected yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {org.channels.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-text">{c.type}</p>
                      <p className="text-xs text-text-secondary">{channelDetail(c)}</p>
                    </div>
                    <Badge variant={c.isActive ? "success" : "default"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text">WhatsApp wallet</h2>
            </div>
            <Input
              label="Low-balance alert (₹)"
              className="w-36"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={saveThreshold}
              disabled={savingThreshold}
            />
          </div>

          {wallet ? (
            <p className="text-2xl font-extrabold text-text tabular-nums">{formatPaise(wallet.balancePaise)}</p>
          ) : (
            <p className="text-sm text-text-secondary">No wallet on file.</p>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <Select
              label="Action"
              className="w-28"
              value={adjustAction}
              onChange={(e) => setAdjustAction(e.target.value as "credit" | "debit")}
            >
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </Select>
            <Input
              label="Amount (₹)"
              className="w-28"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
            <Input
              label="Note"
              className="w-48"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="e.g. Bank transfer received"
            />
            <Button size="sm" variant="secondary" loading={adjusting} onClick={submitAdjustment}>
              Apply
            </Button>
          </div>
          {walletMessage && <p className="text-xs text-text-muted">{walletMessage}</p>}

          {walletTx.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-border pt-3">
              {walletTx.slice(0, 10).map((tx) => (
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
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-bold text-text">Billing</h2>
            <div className="flex items-end gap-2">
              <Input
                label="Monthly fee (₹)"
                className="w-32"
                value={fee}
                onChange={(e) => setFee(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={saveFee}
                disabled={savingFee}
                placeholder="0"
              />
              <Button size="sm" variant="secondary" loading={invoicing} onClick={generateInvoice}>
                Generate invoice
              </Button>
            </div>
          </div>
          {invoiceMessage && <p className="text-xs text-text-muted">{invoiceMessage}</p>}

          {org.invoices.length === 0 ? (
            <p className="text-sm text-text-muted">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-text-secondary">
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Amount</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Status</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Created</th>
                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide uppercase">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {org.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2.5 text-text">₹{inv.amountInr.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
