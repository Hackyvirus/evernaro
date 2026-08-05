import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-text-secondary">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-text">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Dashboard</span>
      </Link>
      {items.map((item, i) => (
        <div key={item.label + i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-text">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
