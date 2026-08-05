import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-md border border-border">
      <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`h-${i}`} className="bg-surface px-3 py-2.5">
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
        {Array.from({ length: rows * columns }).map((_, i) => (
          <div key={`c-${i}`} className="bg-card px-3 py-3">
            <Skeleton className="h-4 w-full max-w-[80%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
