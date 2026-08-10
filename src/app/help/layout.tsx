import Link from "next/link";
import { Logo, ThemeToggle } from "@/components/ui";
import { HelpNav } from "@/components/help/help-nav";
import { MobileNav } from "@/components/mobile-nav";

export const metadata = {
  title: "Evernaro Help Center — User Guide & Tutorials",
  description:
    "Learn how to set up Evernaro, manage appointments, connect communication channels, automate reminders, use AI-assisted replies, and manage your customer conversations.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo width={130} className="w-[120px]" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="hidden items-center gap-4 lg:flex">
              <Link href="/pricing" className="text-sm text-text-secondary hover:text-text">
                Pricing
              </Link>
              <Link href="/help" className="text-sm text-text-secondary hover:text-text">
                Help &amp; User Guide
              </Link>
              <Link href="/contact" className="text-sm text-text-secondary hover:text-text">
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
            </nav>
            <ThemeToggle />
            <MobileNav
              items={[
                { href: "/", label: "Home" },
                { href: "/pricing", label: "Pricing" },
                { href: "/help", label: "Help & User Guide" },
                { href: "/contact", label: "Contact" },
                { href: "/login", label: "Log in" },
              ]}
              cta={{ href: "/signup", label: "Get started" }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:py-12">
        <aside className="lg:w-64 lg:flex-shrink-0">
          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] lg:sticky lg:top-24">
            <p className="mb-3 hidden px-3 text-xs font-semibold tracking-wide text-text-muted uppercase lg:block">
              Categories
            </p>
            <HelpNav />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-text-secondary sm:flex-row">
          <span>© 2026 Eversity Tech LLP</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/" className="hover:text-text">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-text">
              Pricing
            </Link>
            <Link href="/help" className="hover:text-text">
              Help
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
