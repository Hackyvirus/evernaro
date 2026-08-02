// Contact.phone is stored in exactly one canonical format — E.164 with a
// leading '+' (e.g. "+919876543210") — so the same field works for both
// WhatsApp (Gupshup) and Voice (Twilio) without ambiguity. Each provider
// boundary adapts to/from this canonical form; nothing else in the app
// should assume a particular format.

export function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s\-()]/g, "");
  if (!trimmed) return trimmed;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

// Gupshup's WhatsApp API wants numbers WITHOUT a leading '+'.
export function toGupshupFormat(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}
