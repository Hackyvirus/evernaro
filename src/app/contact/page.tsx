export const dynamic = "force-dynamic";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Logo } from "@/components/ui";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo width={150} className="w-[120px] sm:w-[150px]" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="cursor-pointer text-sm text-text-secondary hover:text-text">
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-medium text-primary hover:text-primary-hover">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-text">Contact us</h1>
          <p className="mt-2 text-text-secondary">
            Questions about Evernaro? Send us a message and we&apos;ll get back to you.
          </p>
        </div>

        <ContactForm />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
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
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
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
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo width={150} className="w-[120px] sm:w-[150px]" />
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
