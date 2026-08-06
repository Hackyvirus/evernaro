"use client";

import { useSyncExternalStore } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();

  // Render children without providers during SSR/static prerender to avoid
  // React context hook errors in Next.js 16 static generation.
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
