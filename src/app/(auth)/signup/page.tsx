"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Logo } from "@/components/ui";

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, name, email, password }),
      });

      setLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }

      setCreated(true);
    } catch {
      setError("Network error — check your connection and try again.");
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-lighter blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-light blur-3xl" aria-hidden="true" />
        <Card className="relative w-full max-w-sm p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-text">Verify your email</h1>
          <p className="mt-3 text-sm text-text-secondary">
            We sent a verification link to <strong className="text-text">{email}</strong>. Check your
            inbox and click the link to activate your account.
          </p>
          <p className="mt-4 text-sm text-text-secondary">
            Already verified?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-lighter blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-light blur-3xl" aria-hidden="true" />
      <Card className="relative w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold text-text">Create your Evernaro account</h1>
        <p className="mt-1 text-sm text-text-secondary">By Eversity Tech LLP.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input label="Business name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Input label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-text-muted">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="cursor-pointer text-text-secondary hover:text-text">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="cursor-pointer text-text-secondary hover:text-text">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="cursor-pointer font-medium text-primary hover:text-primary-hover">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
