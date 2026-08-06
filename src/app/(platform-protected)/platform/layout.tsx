import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientProviders } from "@/app/client-providers";
import { PlatformShell } from "./platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) redirect("/platform/login");

  return (
    <ClientProviders>
      <PlatformShell adminName={session.user.name ?? ""}>{children}</PlatformShell>
    </ClientProviders>
  );
}
