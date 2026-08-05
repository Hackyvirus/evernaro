"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Logo } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        totpCode: needsMfa ? totpCode : undefined,
        redirect: false,
      });
      setLoading(false);
      if (res?.error) {
        if (res.error === "MFA_REQUIRED" || res.error === "CredentialsSignin" || res.error === "mfa") {
          // First attempt without MFA code: show MFA field. If the user actually
          // has MFA enabled, the next submission with the code will succeed.
          if (!needsMfa) {
            setNeedsMfa(true);
            return;
          }
        }
        setError(needsMfa ? "Invalid email, password, or authentication code" : "Invalid email or password");
        return;
      }
      router.push("/inbox");
      router.refresh();
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
        <h1 className="text-2xl font-bold text-text">Log in to EverReach</h1>
        <p className="mt-1 text-sm text-text-secondary">One inbox for every customer channel.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={needsMfa}
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={needsMfa}
          />
          {needsMfa && (
            <Input
              label="Authentication code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="6-digit code or 9-digit backup code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            {loading ? "Logging in..." : needsMfa ? "Verify and log in" : "Log in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link href="/forgot-password" className="font-medium text-primary hover:text-primary-hover">
            Forgot password?
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-text-secondary">
          No account?{" "}
          <Link href="/signup" className="cursor-pointer font-medium text-primary hover:text-primary-hover">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
