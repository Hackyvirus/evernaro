import { MessageSquare } from "lucide-react";

export function Logo({
  className = "",
  textClassName = "text-base",
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className={`font-extrabold tracking-tight text-primary ${textClassName}`}>EverReach</span>
    </span>
  );
}
