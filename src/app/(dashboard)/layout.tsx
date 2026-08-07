import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { getOrgIndustryConfig } from "@/lib/industry-config";
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
  const orgId = session.user.orgId;
  if (!orgId) redirect("/login");
  const industry = await getOrgIndustryConfig(orgId);

  return (
    <Providers>
      <RoleProvider role={role}>
        <DashboardShell
          orgName={session.user.orgName ?? ""}
          userName={session.user.name ?? ""}
          userEmail={session.user.email ?? ""}
          role={role}
          emailVerified={session.user.ev ?? false}
          industry={industry}
        >
          {children}
        </DashboardShell>
      </RoleProvider>
    </Providers>
  );
}
