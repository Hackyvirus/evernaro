"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Logo } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-lighter blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-light blur-3xl" aria-hidden="true" />
      <Card className="relative w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold text-text">Reset your password</h1>
        <p className="mt-1 text-sm text-text-secondary">We&apos;ll email you a secure reset link.</p>

        {sent ? (
          <div className="mt-6">
            <p className="text-sm text-text-secondary">
              If an account exists for <strong className="text-text">{email}</strong>, you&apos;ll
              receive a reset link shortly.
            </p>
            <p className="mt-4 text-center text-sm text-text-secondary">
              <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                Back to log in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={loading} className="mt-2 w-full">
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
