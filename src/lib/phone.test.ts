import { describe, expect, it } from "vitest";
import { normalizePhone, toGupshupFormat } from "./phone";

describe("normalizePhone", () => {
  it("adds a leading + when missing", () => {
    expect(normalizePhone("919876543210")).toBe("+919876543210");
  });

  it("leaves an already-E.164 number unchanged", () => {
    expect(normalizePhone("+919876543210")).toBe("+919876543210");
  });

  it("strips spaces, dashes, and parentheses", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("(91) 98765 43210")).toBe("+919876543210");
  });

  it("returns an empty string unchanged rather than producing a bare '+'", () => {
    expect(normalizePhone("   ")).toBe("");
  });
});

describe("toGupshupFormat", () => {
  it("strips the leading + Gupshup doesn't want", () => {
    expect(toGupshupFormat("+919876543210")).toBe("919876543210");
  });

  it("is a no-op when there's no leading +", () => {
    expect(toGupshupFormat("919876543210")).toBe("919876543210");
  });
});
