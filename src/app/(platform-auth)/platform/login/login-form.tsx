"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function PlatformLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("platform-admin", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      setLoading(false);
      if (!res) {
        setError("Login request failed — no response from server.");
        return;
      }
      if (res.error) {
        console.error("Platform login error:", res.error, res.code, res.status);
        setError(res.error === "CredentialsSignin" ? "Invalid email or password" : `Login failed: ${res.error}`);
        return;
      }
      if (res.ok) {
        router.push("/platform");
        router.refresh();
        return;
      }
      setError("Login failed — please try again.");
    } catch (err) {
      console.error("Platform login exception:", err);
      setError("Network error — check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        label="Password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" loading={loading} className="mt-2 w-full">
        {loading ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
