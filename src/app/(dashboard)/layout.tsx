import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { getOrgIndustryConfig } from "@/lib/industry-config";
import { prisma } from "@/lib/prisma";
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
  const locations = await prisma.location.findMany({
    where: { orgId, isActive: true },
    orderBy: { isDefault: "desc" },
    select: { id: true, name: true, isDefault: true },
  });
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { activeLocationId: true },
  });
  const activeLocation = locations.find((l) => l.id === org?.activeLocationId) ?? locations[0] ?? null;

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
          locations={locations}
          activeLocation={activeLocation}
        >
          {children}
        </DashboardShell>
      </RoleProvider>
    </Providers>
  );
}
