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
    // PAST_DUE is a grace period: sends are blocked at the chokepoint so the
    // org cannot run up provider/WhatsApp spend while their subscription is
    // unpaid. The billing UI still shows a banner and a payment link.
    throw new SubscriptionSuspendedError(
      "Account past due — please pay your pending invoice to continue sending messages."
    );
  }
}

export async function getSubscriptionStatus(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { status: true },
  });
  return org?.status ?? OrganizationStatus.ACTIVE;
}
