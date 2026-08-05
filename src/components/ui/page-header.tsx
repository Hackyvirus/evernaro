import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, backHref, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-1 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text" aria-label="Back">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-bold text-text">{title}</h1>
          {description && <p className="text-sm text-text-secondary">{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
