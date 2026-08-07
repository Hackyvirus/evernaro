"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, AuthHeader } from "@/components/ui";

type TemplateOption = {
  code: string;
  name: string;
  description: string;
};

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    fetch("/api/industry-templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
          setIndustryCode(data.templates[0]?.code ?? "");
        }
      })
      .catch(() => {
        setError("Failed to load industries. Please refresh.");
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, name, email, password, industryCode }),
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
          <AuthHeader title="Verify your email" />
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
        <AuthHeader title="Register" />

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label="Business name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="industry" className="text-sm font-medium text-text">
              Industry
            </label>
            <select
              id="industry"
              required
              value={industryCode}
              onChange={(e) => setIndustryCode(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
            {templates.find((t) => t.code === industryCode)?.description && (
              <p className="text-xs text-text-muted">
                {templates.find((t) => t.code === industryCode)?.description}
              </p>
            )}
          </div>
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
