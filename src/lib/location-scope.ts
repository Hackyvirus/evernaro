"server-only";
import { prisma } from "./prisma";

export async function getOrgActiveLocationId(orgId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { activeLocationId: true },
  });
  return org?.activeLocationId ?? null;
}

export async function validateLocationId(locationId: string | undefined | null, orgId: string): Promise<string | null> {
  if (!locationId) return null;
  const location = await prisma.location.findFirst({
    where: { id: locationId, orgId, isActive: true },
    select: { id: true },
  });
  return location?.id ?? null;
}
