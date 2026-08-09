import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/app/providers";
import {
  requireValidPlatformSession,
  UnauthorizedError,
} from "@/lib/session";
import { PlatformShell } from "./platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireValidPlatformSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/platform/login");
    }
    throw error;
  }

  const session = await auth();
  if (!session?.user?.isPlatformAdmin) redirect("/platform/login");

  return (
    <Providers>
      <PlatformShell adminName={session.user.name ?? ""}>{children}</PlatformShell>
    </Providers>
  );
}
