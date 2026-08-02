export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text tabular-nums">{value}</p>
    </div>
  );
}
