import { describe, expect, it } from "vitest";
import { whatsappSendRequiresTemplate, whatsappTemplateBodySchema } from "./whatsapp-template-validation";

describe("whatsappSendRequiresTemplate", () => {
  it("requires a template for WhatsApp with no templateId", () => {
    expect(whatsappSendRequiresTemplate("WHATSAPP", undefined)).toBe(true);
    expect(whatsappSendRequiresTemplate("WHATSAPP", null)).toBe(true);
    expect(whatsappSendRequiresTemplate("WHATSAPP", "")).toBe(true);
  });

  it("is satisfied once a templateId is present", () => {
    expect(whatsappSendRequiresTemplate("WHATSAPP", "tmpl_123")).toBe(false);
  });

  it("never requires a template for other channel types", () => {
    for (const type of ["TELEGRAM", "EMAIL", "INSTAGRAM", "VOICE"]) {
      expect(whatsappSendRequiresTemplate(type, undefined)).toBe(false);
    }
  });
});

describe("whatsappTemplateBodySchema", () => {
  it("accepts a valid template", () => {
    const result = whatsappTemplateBodySchema.safeParse({
      name: "site_visit_reminder",
      category: "UTILITY",
      language: "en",
      bodyText: "Hi {{1}}, your site visit is confirmed for tomorrow.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a body missing the {{1}} placeholder — it can never be sent without it", () => {
    const result = whatsappTemplateBodySchema.safeParse({
      name: "no_placeholder",
      bodyText: "Hi there, your appointment is confirmed.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an uppercase or spaced template name", () => {
    expect(whatsappTemplateBodySchema.safeParse({ name: "Site Visit", bodyText: "{{1}}" }).success).toBe(false);
    expect(whatsappTemplateBodySchema.safeParse({ name: "site-visit", bodyText: "{{1}}" }).success).toBe(false);
  });

  it("defaults category to UTILITY and language to en", () => {
    const result = whatsappTemplateBodySchema.parse({ name: "ok_name", bodyText: "{{1}}" });
    expect(result.category).toBe("UTILITY");
    expect(result.language).toBe("en");
  });
});
