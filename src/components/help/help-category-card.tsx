import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface HelpCategoryCardProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  readingTime: string;
}

export function HelpCategoryCard({ id, title, description, icon: Icon, readingTime }: HelpCategoryCardProps) {
  return (
    <Link
      href={`/help/${id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-lighter">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <span className="text-xs text-text-muted">{readingTime} read</span>
      </div>
      <h3 className="text-base font-semibold text-text group-hover:text-primary-hover">{title}</h3>
      <p className="text-sm text-text-secondary">{description}</p>
      <span className="mt-auto text-sm font-medium text-primary group-hover:text-primary-hover">Read more →</span>
    </Link>
  );
}
