"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, AuthHeader } from "@/components/ui";

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
        // `code` is set explicitly by MfaRequiredError in src/lib/auth.ts and
        // survives the response — unlike `error`, which next-auth normalizes
        // to the generic "CredentialsSignin" for wrong password, inactive
        // account, and rate-limiting alike. Only a real MFA code fetches the
        // second field; everything else gets a real "invalid" message
        // instead of a bogus prompt for a code the user doesn't have.
        if (res.code === "mfa_required" && !needsMfa) {
          setNeedsMfa(true);
          return;
        }
        setError(needsMfa ? "Invalid authentication code" : "Invalid email or password");
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
        <AuthHeader title="Log in" />

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

        <p className="mt-4 text-center text-sm text-text-secondary">
          Platform admin?{" "}
          <Link href="/platform/login" className="font-medium text-primary hover:text-primary-hover">
            Log in here
          </Link>
        </p>
      </Card>
    </div>
  );
}
