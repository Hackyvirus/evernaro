import { prisma } from "@/lib/prisma";
import { CustomerEventType, type Prisma } from "@prisma/client";

const VALID_EVENT_TYPES = new Set<string>(Object.values(CustomerEventType));

export type CustomerEventMetadata = Record<string, unknown>;

/**
 * Records a customer lifecycle event in the timeline.
 * Swallows errors so telemetry never breaks the caller's transaction.
 */
export async function recordCustomerEvent(
  orgId: string,
  contactId: string,
  type: CustomerEventType,
  entityType?: string,
  entityId?: string,
  metadata?: CustomerEventMetadata
) {
  if (!VALID_EVENT_TYPES.has(type)) {
    throw new Error(`Invalid customer event type: ${type}`);
  }

  try {
    return await prisma.customerEvent.create({
      data: {
        orgId,
        contactId,
        type,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[recordCustomerEvent] failed", {
      orgId,
      contactId,
      type,
      entityType,
      entityId,
      err,
    });
    return null;
  }
}
