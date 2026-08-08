"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { Shield } from "lucide-react";

export default function PlatformResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError("Reset link is missing or invalid.");
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/platform/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/platform/login"), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to reset password");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(180_83_9_/_0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgb(124_58_237_/_0.06),transparent_40%)]" aria-hidden="true" />
      <Card className="relative w-full max-w-sm border-l-4 border-l-accent p-8 shadow-elevated">
        <div className="mb-6 text-center">
          <Shield className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-3 text-2xl font-bold text-text">Platform Admin</h1>
          <p className="text-sm text-text-secondary">Create a new password</p>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-success">Password reset successful.</p>
            <p className="mt-2 text-sm text-text-secondary">Redirecting to login...</p>
            <Link href="/platform/login" className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-hover">
              Go to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input label="New password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
