import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-2xl font-bold text-text tabular-nums">{value}</p>
    </div>
  );
}
