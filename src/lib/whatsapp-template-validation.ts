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
