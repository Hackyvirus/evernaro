"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Logo, Select } from "@/components/ui";
import { Bell, Calendar, Check, Clock, CreditCard, MessageSquare } from "lucide-react";

type TemplateOption = {
  code: string;
  name: string;
  description: string;
};

const BENEFITS = [
  { icon: Clock, label: "Live queues & appointments" },
  { icon: Bell, label: "Real-time customer notifications" },
  { icon: MessageSquare, label: "Unified inbox + AI drafts" },
  { icon: CreditCard, label: "Built-in payments & analytics" },
];

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
          <div className="mb-4 flex justify-center">
            <Logo width={150} className="w-[130px] sm:w-[150px]" />
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

  const selectedIndustry = templates.find((t) => t.code === industryCode);

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-2">
      {/* Left panel — value prop */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-accent p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />

        <div className="relative z-10">
          <span className="text-2xl font-bold">Evernaro</span>
          <h2 className="mt-10 text-4xl font-extrabold leading-tight">
            Stop making customers
            <br />
            wait blindly.
          </h2>
          <p className="mt-4 max-w-md text-lg font-medium opacity-90">
            The real-time customer flow platform for modern businesses.
          </p>
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          {BENEFITS.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <item.icon className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-2 text-sm opacity-80">
          <Check className="h-4 w-4" aria-hidden="true" />
          14-day free trial · No credit card required
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="flex justify-center lg:hidden">
              <Logo width={150} className="w-[130px] sm:w-[150px]" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-text">Create your account</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Start your 14-day free trial. No credit card required.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Part 1: Business details */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                1. Business details
              </h3>
              <Input
                label="Business name"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Select
                id="industry"
                label="Industry"
                required
                value={industryCode}
                hint={selectedIndustry?.description}
                onChange={(e) => setIndustryCode(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="border-t border-border" />

            {/* Part 2: Account details */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                2. Account details
              </h3>
              <Input
                label="Your name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" loading={loading} className="w-full">
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
            <Link
              href="/login"
              className="cursor-pointer font-medium text-primary hover:text-primary-hover"
            >
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
