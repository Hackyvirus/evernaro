import type { ChannelType } from "@prisma/client";

// The Contact column each channel type uses to identify a contact — only
// contacts with that field set are reachable on that channel. Shared by
// Campaigns (bulk reachability filter) and Reminders (per-contact check) so
// the two can't drift apart the way the hand-duplicated contact-label
// fallbacks did.
export const CHANNEL_IDENTIFIER_FIELD: Record<ChannelType, "telegramChatId" | "email" | "phone" | "instagramUserId"> = {
  TELEGRAM: "telegramChatId",
  EMAIL: "email",
  WHATSAPP: "phone",
  INSTAGRAM: "instagramUserId",
  VOICE: "phone",
};

export function contactReachableOn(
  channelType: ChannelType,
  contact: { telegramChatId: string | null; email: string | null; phone: string | null; instagramUserId: string | null }
): boolean {
  return Boolean(contact[CHANNEL_IDENTIFIER_FIELD[channelType]]);
}
