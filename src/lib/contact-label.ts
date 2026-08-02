// Shared display-name fallback for a Contact — every channel identifier is
// checked, in priority order. Previously duplicated by hand in 4 different
// dashboard pages, which drifted (some omitted phone and/or instagramUserId,
// so Instagram and some WhatsApp contacts rendered as "Unknown contact"
// everywhere even though a real identifier existed).
export interface ContactLike {
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

export function contactLabel(contact: ContactLike): string {
  return (
    contact.name ||
    contact.email ||
    contact.phone ||
    contact.telegramChatId ||
    contact.instagramUserId ||
    "Unknown contact"
  );
}
