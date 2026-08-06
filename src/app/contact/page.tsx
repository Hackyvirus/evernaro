"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Button, Card, Input, Logo, PageHeader } from "@/components/ui";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setLoading(false);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }

      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setError("Network error — check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo width={150} />
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="cursor-pointer text-sm text-text-secondary hover:text-text">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <PageHeader
          title="Contact us"
          description="Questions about Evernaro? Send us a message and we'll get back to you."
        />

        <Card className="p-6 sm:p-8">
          {sent ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-text">Message sent</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Thanks for reaching out. We&apos;ll reply as soon as possible.
              </p>
              <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-hover">
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label="Name"
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-sm font-medium text-text">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" loading={loading} className="mt-2 w-full sm:w-auto sm:self-start">
                {loading ? "Sending..." : "Send message"}
              </Button>
            </form>
          )}
        </Card>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-text">Sushant Atram</h2>
            <p className="text-sm text-text-secondary">Co-founder</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a href="tel:+919356381344" className="flex items-center gap-2 text-text-secondary hover:text-primary">
                <Phone className="h-4 w-4" />
                +91 93563 81344
              </a>
              <a href="mailto:sushant@evernaro.com" className="flex items-center gap-2 text-text-secondary hover:text-primary">
                <Mail className="h-4 w-4" />
                sushant@evernaro.com
              </a>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-text">Snehal Dongre</h2>
            <p className="text-sm text-text-secondary">Co-founder</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a href="tel:+918080202954" className="flex items-center gap-2 text-text-secondary hover:text-primary">
                <Phone className="h-4 w-4" />
                +91 80802 02954
              </a>
              <a href="mailto:snehal@evernaro.com" className="flex items-center gap-2 text-text-secondary hover:text-primary">
                <Mail className="h-4 w-4" />
                snehal@evernaro.com
              </a>
            </div>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo width={150} />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/terms" className="cursor-pointer hover:text-text-secondary">
              Terms
            </Link>
            <Link href="/privacy" className="cursor-pointer hover:text-text-secondary">
              Privacy
            </Link>
            <span>&copy; 2026 Eversity Tech LLP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
