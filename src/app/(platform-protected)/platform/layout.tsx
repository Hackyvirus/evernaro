import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { PlatformShell } from "./platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) redirect("/platform/login");

  return (
    <Providers>
      <PlatformShell adminName={session.user.name ?? ""}>{children}</PlatformShell>
    </Providers>
  );
}
