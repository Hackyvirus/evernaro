// Contact.phone is stored in exactly one canonical format — E.164 with a
// leading '+' (e.g. "+919876543210") — so the same field works for both
// WhatsApp (Gupshup) and Voice (Twilio) without ambiguity. Each provider
// boundary adapts to/from this canonical form; nothing else in the app
// should assume a particular format.

export function normalizePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s\-()]/g, "");
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  // A bare 10-digit number starting with 6-9 is almost certainly an Indian
  // mobile number typed without its country code -- this product's whole
  // audience is Indian SMBs. Just prepending "+" (the old behavior) turned
  // "9356381344" into "+9356381344": syntactically E.164-shaped enough to
  // pass length validation, but not a real, deliverable number (missing the
  // 91), so WhatsApp sends silently failed at Gupshup with "Invalid App
  // Details"-style rejections that had nothing to do with the app config.
  if (/^[6-9]\d{9}$/.test(trimmed)) return `+91${trimmed}`;
  return `+${trimmed}`;
}

// E.164 allows at most 15 digits total, and a valid number never starts with
// 0 after the country code. Public-facing forms (queue join, booking) only
// had a bare z.string().min(5) before this, so "abc" or a 500-character
// string both passed validation and were stored as-is.
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidPhone(input: string): boolean {
  return E164_PATTERN.test(normalizePhone(input));
}

// Gupshup's WhatsApp API wants numbers WITHOUT a leading '+'.
export function toGupshupFormat(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}
