import { describe, expect, it } from "vitest";
import { normalizePhone, toGupshupFormat, isValidPhone } from "./phone";

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

describe("isValidPhone", () => {
  it("accepts a plain E.164 number", () => {
    expect(isValidPhone("+919876543210")).toBe(true);
  });

  it("accepts a number needing normalization first", () => {
    expect(isValidPhone("91 98765-43210")).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(isValidPhone("abcdefgh")).toBe(false);
  });

  it("rejects a number that's too short", () => {
    expect(isValidPhone("+1234")).toBe(false);
  });

  it("rejects an absurdly long string, not just letters", () => {
    expect(isValidPhone("9".repeat(500))).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidPhone("")).toBe(false);
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
