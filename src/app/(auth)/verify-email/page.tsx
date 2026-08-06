"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, AuthHeader } from "@/components/ui";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [error, setError] = useState<string | null>(token ? null : "Missing verification token");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setError(data.error ?? "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Network error — try again later");
      });
  }, [token]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-lighter blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-light blur-3xl" aria-hidden="true" />
        <Card className="relative w-full max-w-sm p-8 text-center">
          <AuthHeader title={status === "success" ? "Email verified" : "Verifying your email"} />
        {status === "loading" && <p className="text-sm text-text-secondary">Please wait...</p>}
        {status === "success" && (
          <>
            <p className="mt-3 text-sm text-text-secondary">
              Your email is verified. You can now log in to Evernaro.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                Log in
              </Link>
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="mt-3 text-sm text-danger">{error ?? "Verification failed"}</p>
            <p className="mt-4 text-sm text-text-secondary">
              <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                Back to log in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
