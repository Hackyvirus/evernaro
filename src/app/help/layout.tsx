import Link from "next/link";
import { Logo, ThemeToggle } from "@/components/ui";
import { HelpNav } from "@/components/help/help-nav";

export const metadata = {
  title: "Evernaro Help Center — User Guide & Tutorials",
  description:
    "Learn how to set up Evernaro, manage appointments, connect communication channels, automate reminders, use AI-assisted replies, and manage your customer conversations.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo width={130} className="w-[120px]" />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="hidden text-sm text-text-secondary hover:text-text sm:block">
              Pricing
            </Link>
            <Link href="/contact" className="hidden text-sm text-text-secondary hover:text-text sm:block">
              Contact
            </Link>
            <Link href="/login" className="text-sm text-text-secondary hover:text-text">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Get started
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:flex-row lg:py-12">
        <aside className="lg:w-64 lg:flex-shrink-0">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 px-3 text-xs font-semibold tracking-wide text-text-muted uppercase">Categories</p>
            <HelpNav />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-text-secondary sm:flex-row">
          <span>© 2026 Eversity Tech LLP</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-text">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-text">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-text">
              Contact
            </Link>
            <Link href="/privacy" className="hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-text">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
