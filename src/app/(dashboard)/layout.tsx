import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "./dashboard-shell";
import { RoleProvider } from "./role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user.role ?? "AGENT") as "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

  return (
    <RoleProvider role={role}>
      <DashboardShell
        orgName={session.user.orgName ?? ""}
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
        role={role}
        emailVerified={session.user.ev ?? false}
      >
        {children}
      </DashboardShell>
    </RoleProvider>
  );
}
