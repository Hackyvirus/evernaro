"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { Shield } from "lucide-react";

export default function PlatformForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/platform/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(180_83_9_/_0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgb(124_58_237_/_0.06),transparent_40%)]" aria-hidden="true" />
        <Card className="relative w-full max-w-sm border-l-4 border-l-accent p-8 text-center shadow-elevated">
          <Shield className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 text-xl font-bold text-text">Check your email</h1>
          <p className="mt-2 text-sm text-text-secondary">
            If a platform admin account exists for <strong>{email}</strong>, a password reset link has been sent.
          </p>
          <Link href="/platform/login" className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-hover">
            Back to admin login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(180_83_9_/_0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgb(124_58_237_/_0.06),transparent_40%)]" aria-hidden="true" />
      <Card className="relative w-full max-w-sm border-l-4 border-l-accent p-8 shadow-elevated">
        <div className="mb-6 text-center">
          <Shield className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-3 text-2xl font-bold text-text">Platform Admin</h1>
          <p className="text-sm text-text-secondary">Reset your password</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link href="/platform/login" className="font-medium text-primary hover:text-primary-hover">
            Back to admin login
          </Link>
        </p>
      </Card>
    </div>
  );
}
