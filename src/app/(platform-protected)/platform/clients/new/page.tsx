"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export default function NewClientPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [monthlyFeeInr, setMonthlyFeeInr] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function createClient() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          ownerName,
          ownerEmail,
          ownerPassword,
          monthlyFeeInr: monthlyFeeInr ? Number(monthlyFeeInr) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Failed to create client");
        return;
      }
      router.push("/platform");
      router.refresh();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-4 text-center sm:text-start">
        <h1 className="text-xl font-bold text-text">Add client</h1>
        <p className="text-sm text-text-secondary">
          Create a client org and its owner account directly — for onboarding clients yourself
          rather than having them self-sign-up.
        </p>
      </header>

      <div className="max-w-md p-6">
        <Card className="flex flex-col gap-4 p-4">
          <Input label="Business name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Input label="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          <Input
            label="Owner email"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
          />
          <Input
            label="Owner password"
            type="password"
            minLength={8}
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            hint="Share this with the client separately."
          />
          <Input
            label="Monthly fee, ₹ (optional)"
            value={monthlyFeeInr}
            onChange={(e) => setMonthlyFeeInr(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="2999"
          />

          <Button
            onClick={createClient}
            loading={status === "saving"}
            disabled={!orgName || !ownerName || !ownerEmail || !ownerPassword}
            className="w-fit"
          >
            {status === "saving" ? "Creating..." : "Create client"}
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
