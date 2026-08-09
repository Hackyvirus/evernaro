import { describe, it, expect } from "vitest";
import { toZonedISO } from "./timezone";

describe("toZonedISO", () => {
  it("converts Asia/Kolkata wall-clock time to the correct UTC instant", () => {
    const iso = toZonedISO("2026-08-10", "14:30", "Asia/Kolkata");
    // Asia/Kolkata is UTC+5:30, so 14:30 IST -> 09:00 UTC.
    expect(iso).toBe("2026-08-10T09:00:00.000Z");
  });

  it("converts America/New_York wall-clock time to the correct UTC instant", () => {
    // August 10 is EDT (UTC-4) in New York.
    const iso = toZonedISO("2026-08-10", "14:30", "America/New_York");
    expect(iso).toBe("2026-08-10T18:30:00.000Z");
  });

  it("throws on invalid date input", () => {
    expect(() => toZonedISO("not-a-date", "10:00", "UTC")).toThrow("Invalid date or time");
  });

  it("throws on invalid time input", () => {
    expect(() => toZonedISO("2026-08-10", "not-a-time", "UTC")).toThrow("Invalid date or time");
  });
});
