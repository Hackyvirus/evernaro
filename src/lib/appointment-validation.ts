import { prisma } from "@/lib/prisma";

export type AppointmentRelationInput = {
  contactId: string;
  serviceId?: string;
  staffId?: string;
  resourceId?: string;
  locationId?: string | null;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string; status: 404 };

/**
 * Verify that every relation ID passed for an appointment actually belongs to
 * the target organization. This prevents cross-tenant references that would
 * otherwise pass through FK checks alone.
 */
export async function validateAppointmentRelations(
  orgId: string,
  input: AppointmentRelationInput
): Promise<ValidationResult> {
  const { contactId, serviceId, staffId, resourceId, locationId } = input;

  const [contact, service, staff, resource, location] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, orgId },
      select: { id: true },
    }),
    serviceId
      ? prisma.service.findFirst({
          where: { id: serviceId, orgId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve({ id: serviceId } as { id: string }),
    staffId
      ? prisma.staffProfile.findFirst({
          where: { id: staffId, orgId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve({ id: staffId } as { id: string }),
    resourceId
      ? prisma.resource.findFirst({
          where: { id: resourceId, orgId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve({ id: resourceId } as { id: string }),
    locationId
      ? prisma.location.findFirst({
          where: { id: locationId, orgId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve({ id: locationId } as { id: string }),
  ]);

  if (!contact) {
    return { ok: false, error: "Contact not found", status: 404 };
  }
  if (serviceId && !service) {
    return { ok: false, error: "Service not found or inactive", status: 404 };
  }
  if (staffId && !staff) {
    return { ok: false, error: "Staff member not found or inactive", status: 404 };
  }
  if (resourceId && !resource) {
    return { ok: false, error: "Resource not found or inactive", status: 404 };
  }
  if (locationId && !location) {
    return { ok: false, error: "Location not found or inactive", status: 404 };
  }

  return { ok: true };
}
