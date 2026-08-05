import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

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
// JWT's orgId claim alone — a session JWT is valid (and this app's default
// maxAge is Auth.js's 30-day default) long after a user could be removed
// from an org, so trusting the claim alone would let a stale session keep
// full access for weeks after that.
export async function requireOrgId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) throw new UnauthorizedError("Not authenticated");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true, isActive: true },
  });
  if (!user || user.orgId !== session.user.orgId || !user.isActive) {
    throw new UnauthorizedError("Session no longer valid");
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
    select: { orgId: true, role: true, isActive: true },
  });
  if (!user || user.orgId !== session.user.orgId || !user.isActive) {
    throw new UnauthorizedError("Session no longer valid");
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

export async function requirePlatformAdminId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.isPlatformAdmin) {
    throw new UnauthorizedError("Not authenticated as platform admin");
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { id: session.user.id } });
  if (!admin) throw new UnauthorizedError("Session no longer valid");

  return admin.id;
}
