import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {}

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
    select: { orgId: true },
  });
  if (!user || user.orgId !== session.user.orgId) {
    throw new UnauthorizedError("Session no longer valid");
  }

  return session.user.orgId;
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
