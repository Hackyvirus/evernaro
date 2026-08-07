"server-only";
import { prisma } from "@/lib/prisma";

export async function logBillingEvent(
  orgId: string,
  subscriptionId: string | null,
  eventType: string,
  payload: Record<string, unknown>
) {
  return prisma.billingEvent.create({
    data: {
      orgId,
      subscriptionId,
      eventType,
      payload: payload as never,
    },
  });
}
