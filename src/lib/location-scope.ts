"server-only";
import { prisma } from "./prisma";

export async function getOrgActiveLocationId(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { activeLocationId: true },
  });
  return org?.activeLocationId ?? null;
}
