"server-only";

import { prisma } from "@/lib/prisma";
import { ChannelType, type Channel, type Contact } from "@prisma/client";

// WhatsApp first -- it's the primary channel for this product's Indian SMB
// audience, and the one every customer-facing notification is really built
// around (queue codes, reminders, review requests all lean on it).
const CHANNEL_PRIORITY: ChannelType[] = [ChannelType.WHATSAPP, ChannelType.TELEGRAM, ChannelType.EMAIL];

export function isContactReachable(contact: Contact, channelType: ChannelType): boolean {
  switch (channelType) {
    case ChannelType.WHATSAPP:
      return Boolean(contact.phone);
    case ChannelType.TELEGRAM:
      return Boolean(contact.telegramChatId);
    case ChannelType.EMAIL:
      return Boolean(contact.email);
    default:
      return false;
  }
}

/**
 * Picks the first active channel the given contact can actually be reached
 * on, in priority order -- not just the first active channel the org
 * happens to have, regardless of whether this specific contact has the
 * matching phone/email/telegram field.
 *
 * The three previous copies of this selection (queue notifications,
 * appointment reminders, review requests) all used
 * `prisma.channel.findFirst({ orderBy: { type: "asc" } })`, which sorts
 * alphabetically -- EMAIL before TELEGRAM before WHATSAPP -- with no
 * awareness of the contact at all. An org with both Email and WhatsApp
 * configured would always pick Email first; for any contact with a phone
 * but no email (the overwhelmingly common case for a WhatsApp-first
 * product), every notification silently no-op'd or was scheduled against a
 * channel that would fail at send time, with no error surfaced anywhere.
 */
export async function chooseChannelForContact(orgId: string, contact: Contact): Promise<Channel | null> {
  const channels = await prisma.channel.findMany({
    where: { orgId, isActive: true, type: { in: CHANNEL_PRIORITY } },
  });
  for (const type of CHANNEL_PRIORITY) {
    const channel = channels.find((c) => c.type === type);
    if (channel && isContactReachable(contact, channel.type)) return channel;
  }
  return null;
}
