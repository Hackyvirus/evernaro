import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/app/providers";
import { getOrgIndustryConfig } from "@/lib/industry-config";
import { prisma } from "@/lib/prisma";
import {
  requireValidDashboardSession,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/session";
import { DashboardShell } from "./dashboard-shell";
import { RoleProvider } from "./role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let sessionCheck;
  try {
    sessionCheck = await requireValidDashboardSession();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  const session = await auth();
  if (!session?.user) redirect("/login");

  // Use the DB-verified role so a demoted user doesn't keep seeing the old
  // JWT role in the dashboard chrome.
  const role = sessionCheck.role as "OWNER" | "ADMIN" | "AGENT" | "VIEWER";
  const orgId = sessionCheck.orgId;
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
