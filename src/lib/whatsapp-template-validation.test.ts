import { describe, expect, it } from "vitest";
import {
  buildTemplateExample,
  templateVariableCount,
  whatsappSendRequiresTemplate,
  whatsappTemplateBodySchema,
} from "./whatsapp-template-validation";

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

describe("templateVariableCount", () => {
  it("counts distinct {{n}} variables", () => {
    expect(templateVariableCount("Hi {{1}}, your {{2}} at {{3}} is on {{4}} at {{5}}.")).toBe(5);
  });

  it("is 0 for a body with no variables and 1 for name-only", () => {
    expect(templateVariableCount("Thanks for visiting!")).toBe(0);
    expect(templateVariableCount("Hi {{1}}, thanks!")).toBe(1);
  });

  it("does not double-count a repeated variable", () => {
    expect(templateVariableCount("{{1}} — see you soon {{1}}")).toBe(1);
  });
});

describe("buildTemplateExample", () => {
  it("fills a single {{1}} placeholder", () => {
    expect(buildTemplateExample("Hi {{1}}, your visit is confirmed.")).toBe(
      "Hi there, your visit is confirmed."
    );
  });

  it("fills every distinct placeholder, not just {{1}} -- this was the actual bug: only {{1}} was ever filled, so Meta rejected any template with a {{2}} or later variable for having a literal '{{2}}' left in the submitted example", () => {
    const body = "Hi {{1}}, it's your turn at {{2}}! Token {{3}}. Show this code: {{4}}.";
    const example = buildTemplateExample(body);
    expect(example).not.toMatch(/\{\{\d+\}\}/);
    expect(example).toBe("Hi there, it's your turn at Sunrise Clinic! Token A-101. Show this code: 3.");
  });

  it("fills a repeated placeholder consistently", () => {
    expect(buildTemplateExample("{{1}} confirmed for {{1}}")).toBe("there confirmed for there");
  });

  it("falls back to a generic sample beyond the curated list", () => {
    const body = "{{1}} {{2}} {{3}} {{4}} {{5}} {{6}} {{7}} {{8}}";
    const example = buildTemplateExample(body);
    expect(example).not.toMatch(/\{\{\d+\}\}/);
    expect(example.endsWith("sample8")).toBe(true);
  });
});
