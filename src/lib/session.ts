import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, OrganizationStatus } from "@prisma/client";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

// Role hierarchy from least to most privileged.
const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.VIEWER]: 0,
  [UserRole.AGENT]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.OWNER]: 3,
};

// Re-verifies against the database on every call rather than trusting the
// JWT's orgId claim alone — even a 1-day JWT can outlast a user being
// deactivated, demoted, or removed from an org, so trusting the claim alone
// would let a stale session keep access until expiry.
export async function requireOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) throw new UnauthorizedError("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      orgId: true,
      isActive: true,
      emailVerified: true,
      tokenVersion: true,
      org: { select: { status: true } },
    },
  });
  if (!user || user.orgId !== session.user.orgId || !user.isActive) {
    throw new UnauthorizedError("Session no longer valid");
  }
  if (user.org.status !== OrganizationStatus.ACTIVE && user.org.status !== OrganizationStatus.PAST_DUE) {
    throw new UnauthorizedError("Organization is not active");
  }
  if (!user.emailVerified) {
    throw new ForbiddenError("Email verification required");
  }
  if (user.tokenVersion !== (session.user as unknown as { tv?: number }).tv) {
    throw new UnauthorizedError("Session has been invalidated");
  }

  return session.user.orgId;
}

// Loads the current org user and verifies they have at least the required
// role. Returns { orgId, userId, role } for use in API routes.
export async function requireOrgMember(minRole: UserRole = UserRole.AGENT): Promise<{ orgId: string; userId: string; role: UserRole }> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId || !session?.user?.role) {
    throw new UnauthorizedError("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      orgId: true,
      role: true,
      isActive: true,
      emailVerified: true,
      tokenVersion: true,
      org: { select: { status: true } },
    },
  });
  if (!user || user.orgId !== session.user.orgId || !user.isActive) {
    throw new UnauthorizedError("Session no longer valid");
  }
  if (user.org.status !== OrganizationStatus.ACTIVE && user.org.status !== OrganizationStatus.PAST_DUE) {
    throw new UnauthorizedError("Organization is not active");
  }
  if (!user.emailVerified) {
    throw new ForbiddenError("Email verification required");
  }
  if (user.tokenVersion !== (session.user as unknown as { tv?: number }).tv) {
    throw new UnauthorizedError("Session has been invalidated");
  }

  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError("Insufficient permissions");
  }

  return { orgId: session.user.orgId, userId: session.user.id, role: user.role };
}

// Helper for pages/routes that only need to know the user is an org member.
export async function requireOrgUser(): Promise<{ orgId: string; userId: string; role: UserRole }> {
  return requireOrgMember(UserRole.VIEWER);
}

// Re-validates the current dashboard session against the DB before rendering
// protected pages. Throws UnauthorizedError/ForbiddenError if the user no
// longer exists, is inactive, was removed from the org, or lacks permission.
export async function requireValidDashboardSession(): Promise<{ orgId: string; userId: string; role: UserRole }> {
  return requireOrgUser();
}

export async function requirePlatformAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.isPlatformAdmin) {
    throw new UnauthorizedError("Not authenticated as platform admin");
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { id: session.user.id },
    select: { id: true, tokenVersion: true },
  });
  if (!admin) throw new UnauthorizedError("Session no longer valid");
  if (admin.tokenVersion !== (session.user as unknown as { tv?: number }).tv) {
    throw new UnauthorizedError("Session has been invalidated");
  }

  return admin.id;
}

// Re-validates the current platform-admin session against the DB before
// rendering protected platform pages. Throws UnauthorizedError if the admin
// row no longer exists.
export async function requireValidPlatformSession(): Promise<string> {
  return requirePlatformAdminId();
}
