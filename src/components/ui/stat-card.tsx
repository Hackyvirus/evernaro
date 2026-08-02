export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}
