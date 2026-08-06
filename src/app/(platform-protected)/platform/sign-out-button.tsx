"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function PlatformSignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/platform/login" })}
        aria-label="Log out"
        className="group relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-hover hover:text-text"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border border-border bg-card-elevated px-2 py-1 text-xs font-medium text-text opacity-0 shadow-[var(--shadow-elevated)] transition-opacity group-hover:opacity-100"
        >
          Log out
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/platform/login" })}
      className="cursor-pointer rounded-md px-2 py-1.5 text-start text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text"
    >
      Log out
    </button>
  );
}
