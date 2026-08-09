"server-only";

import { OrganizationStatus, SubscriptionStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Subscription statuses that grant full access to paid features.
 * INCOMPLETE is intentionally excluded: a subscription is only INCOMPLETE
 * while a payment attempt is in flight and must not unlock messaging,
 * campaigns, or other billable actions.
 */
export const SUBSCRIPTION_ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
];

/**
 * Subscription statuses that must block paid functionality.
 */
export const SUBSCRIPTION_BLOCKING_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELLED,
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.PAYMENT_FAILED,
  SubscriptionStatus.INCOMPLETE,
];

/**
 * Map a subscription status to the authoritative organization status.
 * The organization status is the single chokepoint used by send-guards.
 */
export function mapSubscriptionStatusToOrganizationStatus(
  status: SubscriptionStatus
): OrganizationStatus {
  if (SUBSCRIPTION_ACTIVE_STATUSES.includes(status)) {
    return OrganizationStatus.ACTIVE;
  }
  if (status === SubscriptionStatus.PAST_DUE) {
    return OrganizationStatus.PAST_DUE;
  }
  return OrganizationStatus.SUSPENDED;
}

/**
 * Recompute the organization status from its most recent subscription.
 * Call this whenever a subscription transitions (payment success/failure,
 * cancellation, trial expiry, plan change finalization, etc.).
 */
export async function syncOrganizationStatusFromSubscription(orgId: string, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const subscriptions = await client.customerSubscription.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  // If any subscription is active/trialing, the org stays ACTIVE. A pending
  // INCOMPLETE subscription (e.g. a plan-change attempt that has not been paid
  // yet) must not downgrade the org while the previous subscription is still
  // valid.
  const active = subscriptions.find((s) =>
    SUBSCRIPTION_ACTIVE_STATUSES.includes(s.status)
  );
  const pastDue = subscriptions.find((s) => s.status === SubscriptionStatus.PAST_DUE);

  let target: OrganizationStatus;
  if (active) {
    target = OrganizationStatus.ACTIVE;
  } else if (pastDue) {
    target = OrganizationStatus.PAST_DUE;
  } else if (subscriptions.length > 0) {
    target = OrganizationStatus.SUSPENDED;
  } else {
    target = OrganizationStatus.SUSPENDED;
  }

  await client.organization.update({
    where: { id: orgId },
    data: { status: target },
  });
}
