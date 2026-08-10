import Link from "next/link";
import { HelpSearch } from "@/components/help/help-search";
import { HelpCategoryCard } from "@/components/help/help-category-card";
import { HELP_CATEGORIES } from "@/lib/help-data";
import { Button } from "@/components/ui";

export default function HelpCenterPage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-text sm:text-3xl lg:text-4xl">Evernaro Help Center</h1>
        <p className="mx-auto mt-3 max-w-2xl px-2 text-base text-text-secondary sm:px-0">
          Step-by-step guides to set up your business, connect customer channels, manage appointments, and use the AI
          assistant. For salons, clinics, restaurants, and service businesses.
        </p>
        <div className="mx-auto mt-6 flex justify-center px-2 sm:px-0">
          <HelpSearch />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 px-2 text-sm text-text-muted sm:gap-3 sm:px-0">
          <span>Popular:</span>
          <Link href="/help/getting-started" className="text-primary hover:text-primary-hover hover:underline">
            Getting started
          </Link>
          <Link href="/help/channels" className="text-primary hover:text-primary-hover hover:underline">
            Connect WhatsApp
          </Link>
          <Link href="/help/services-appointments" className="text-primary hover:text-primary-hover hover:underline">
            Appointments
          </Link>
          <Link href="/help/troubleshooting" className="text-primary hover:text-primary-hover hover:underline">
            Troubleshooting
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_CATEGORIES.map((category) => (
          <HelpCategoryCard
            key={category.id}
            id={category.id}
            title={category.title}
            description={category.description}
            icon={category.icon}
            readingTime={category.readingTime}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-center shadow-[var(--shadow-card)] sm:p-6">
        <h2 className="text-lg font-bold text-text sm:text-xl">Can&apos;t find what you need?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">
          Our team can help you set up channels, troubleshoot issues, or understand a feature. Reach out from your
          registered email address.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="mailto:support@evernaro.com">
            <Button>Contact support</Button>
          </a>
          <Link href="/signup">
            <Button variant="secondary">Start free trial</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
