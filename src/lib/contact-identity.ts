import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { requireUsageLimit, UsageLimitExceededError } from "@/lib/billing/entitlements";
import type { Contact } from "@prisma/client";

export { UsageLimitExceededError };

export interface ContactIdentityInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  telegramChatId?: string | null;
  instagramUserId?: string | null;
}

function normalizeInput(input: ContactIdentityInput): ContactIdentityInput {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email?.trim().toLowerCase() || null;
  const telegramChatId = input.telegramChatId?.trim() || null;
  const instagramUserId = input.instagramUserId?.trim() || null;
  const name = input.name?.trim() || null;
  return { name, phone, email, telegramChatId, instagramUserId };
}

/**
 * Enforce the contacts usage limit only when the input would create a brand-new
 * contact. Existing contacts being updated do not consume quota.
 */
export async function requireContactLimitIfNew(
  input: ContactIdentityInput,
  orgId: string
): Promise<void> {
  const normalized = normalizeInput(input);
  if (!normalized.phone && !normalized.email && !normalized.telegramChatId && !normalized.instagramUserId) {
    return;
  }

  const existing = await prisma.contact.findFirst({
    where: {
      orgId,
      OR: [
        ...(normalized.phone ? [{ phone: normalized.phone }] : []),
        ...(normalized.email ? [{ email: normalized.email }] : []),
        ...(normalized.telegramChatId ? [{ telegramChatId: normalized.telegramChatId }] : []),
        ...(normalized.instagramUserId ? [{ instagramUserId: normalized.instagramUserId }] : []),
      ],
    },
  });

  if (!existing) {
    await requireUsageLimit(orgId, "contacts", 1);
  }
}

function buildUpdatePayload(
  existing: Contact,
  normalized: ContactIdentityInput
): Partial<ContactIdentityInput> {
  const payload: ContactIdentityInput = {};

  if (normalized.name) {
    payload.name = normalized.name;
  }

  if (normalized.phone && existing.phone !== normalized.phone) {
    payload.phone = normalized.phone;
  }

  if (normalized.email && existing.email !== normalized.email) {
    payload.email = normalized.email;
  }

  if (normalized.telegramChatId && existing.telegramChatId !== normalized.telegramChatId) {
    payload.telegramChatId = normalized.telegramChatId;
  }

  if (normalized.instagramUserId && existing.instagramUserId !== normalized.instagramUserId) {
    payload.instagramUserId = normalized.instagramUserId;
  }

  return payload;
}

/**
 * Find an existing contact in `orgId` matching any of the provided identifiers
 * (phone, email, telegramChatId, instagramUserId), update missing fields, or
 * create a new contact if none is found.
 *
 * Phone is normalized to E.164 with a leading '+'; email is lowercased.
 * Existing non-empty names are never overwritten with empty values.
 */
export async function findOrCreateContact(
  input: ContactIdentityInput,
  orgId: string,
  maxRetries = 2
): Promise<Contact> {
  const normalized = normalizeInput(input);

  if (!normalized.phone && !normalized.email && !normalized.telegramChatId && !normalized.instagramUserId) {
    throw new Error("At least one of phone, email, telegramChatId, or instagramUserId is required");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.contact.findFirst({
          where: {
            orgId,
            OR: [
              ...(normalized.phone ? [{ phone: normalized.phone }] : []),
              ...(normalized.email ? [{ email: normalized.email }] : []),
              ...(normalized.telegramChatId ? [{ telegramChatId: normalized.telegramChatId }] : []),
              ...(normalized.instagramUserId ? [{ instagramUserId: normalized.instagramUserId }] : []),
            ],
          },
        });

        if (existing) {
          const updateData = buildUpdatePayload(existing, normalized);
          if (Object.keys(updateData).length === 0) {
            return existing;
          }
          return tx.contact.update({ where: { id: existing.id }, data: updateData });
        }

        return tx.contact.create({
          data: {
            orgId,
            name: normalized.name,
            phone: normalized.phone,
            email: normalized.email,
            telegramChatId: normalized.telegramChatId,
            instagramUserId: normalized.instagramUserId,
          },
        });
      });
    } catch (err) {
      // P2002 = unique constraint violation. A concurrent transaction created
      // the contact between our find and create, so retry to find/update it.
      if (isUniqueConstraintError(err)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Failed to find or create contact");
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
