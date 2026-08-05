interface AvatarProps {
  name?: string | null;
  className?: string;
}

export function Avatar({ name, className = "" }: AvatarProps) {
  const initial = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ${className}`}
      aria-hidden="true"
    >
      {initial || "?"}
    </div>
  );
}

interface AvatarStackProps {
  names?: string[];
  className?: string;
}

export function AvatarStack({ names, className = "" }: AvatarStackProps) {
  return (
    <div className={`flex -space-x-1.5 ${className}`}>
      {names?.slice(0, 3).map((name, i) => (
        <Avatar key={i} name={name} className="h-6 w-6 border-2 border-card text-[10px]" />
      ))}
    </div>
  );
}
