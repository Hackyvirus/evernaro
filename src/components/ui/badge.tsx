import { ReactNode } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "primary";

const variantClasses: Record<Variant, string> = {
  default: "bg-surface text-text-secondary",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  primary: "bg-primary-light text-primary",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
