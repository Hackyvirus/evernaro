import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-2 py-8" : "flex-1 px-6 py-16"}`}>
      {Icon && (
        <div className={`mb-3 flex items-center justify-center rounded-full bg-surface ${compact ? "h-8 w-8" : "h-12 w-12"}`}>
          <Icon className={`text-text-muted ${compact ? "h-4 w-4" : "h-6 w-6"}`} aria-hidden="true" />
        </div>
      )}
      <p className={`font-medium text-text ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
      {description && <p className={`max-w-sm text-text-secondary ${compact ? "mt-1 text-xs" : "mt-1 text-sm"}`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
