import { OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class SubscriptionSuspendedError extends Error {}

export async function requireActiveSubscription(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { status: true, name: true },
  });
  if (!org) {
    throw new SubscriptionSuspendedError("Organization not found");
  }
  if (org.status === OrganizationStatus.SUSPENDED) {
    throw new SubscriptionSuspendedError(
      "Account suspended — please settle your pending invoice to continue sending messages."
    );
  }
  if (org.status === OrganizationStatus.PAST_DUE) {
    // PAST_DUE is a warning state; allow sends but surface a banner.
    // Callers that want strict blocking can check status directly.
    return;
  }
}

export async function getSubscriptionStatus(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { status: true },
  });
  return org?.status ?? OrganizationStatus.ACTIVE;
}
