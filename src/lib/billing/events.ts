"server-only";
import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logBillingEvent(
  orgId: string,
  subscriptionId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return client.billingEvent.create({
    data: {
      orgId,
      subscriptionId,
      eventType,
      metadata: payload as never,
    },
  });
}
