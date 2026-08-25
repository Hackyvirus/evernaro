import { z } from "zod";

// Meta rejects free-text WhatsApp messages sent outside a 24-hour window
// since the contact's last inbound message — Campaigns and Reminders are
// proactive sends (usually outside that window), so they must go through an
// approved template. Shared by src/app/api/campaigns/route.ts and
// src/app/api/reminders/route.ts.
export function whatsappSendRequiresTemplate(
  channelType: string,
  whatsappTemplateId: string | null | undefined
): boolean {
  return channelType === "WHATSAPP" && !whatsappTemplateId;
}

// Meta requires a realistic, non-empty example value for every {{n}}
// variable in a template body before it will review it -- a variable left
// as a literal "{{2}}" (or missing from the example entirely) is a
// near-guaranteed rejection. This fills each distinct {{n}} found in the
// body with a varied, plausible-looking sample so multi-variable templates
// (queue notifications use up to 5) don't get silently submitted with only
// {{1}} filled in.
const GENERIC_EXAMPLE_VALUES = ["there", "Sunrise Clinic", "A-101", "3", "482913", "2", "15"];

export function buildTemplateExample(bodyText: string): string {
  const placeholders = new Set(Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g), (m) => m[1]));
  let example = bodyText;
  for (const n of placeholders) {
    const index = Number(n) - 1;
    const value = GENERIC_EXAMPLE_VALUES[index] ?? `sample${n}`;
    example = example.replaceAll(`{{${n}}}`, value);
  }
  return example;
}

// Validates a new template submission (src/app/api/whatsapp-templates/route.ts).
// {{1}} is required because the send path always fills it with the
// contact's name — a template without it can't actually be sent.
export const whatsappTemplateBodySchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  category: z.enum(["MARKETING", "UTILITY"]).default("UTILITY"),
  language: z.string().min(2).default("en"),
  bodyText: z
    .string()
    .min(1)
    .refine((s) => s.includes("{{1}}"), {
      message: "Body must include a {{1}} placeholder — it's filled with the contact's name when sent",
    }),
});
