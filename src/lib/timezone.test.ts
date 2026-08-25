import { describe, it, expect } from "vitest";
import { toZonedISO, startOfDayInTimezone } from "./timezone";

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

describe("startOfDayInTimezone", () => {
  it("returns midnight IST as the correct UTC instant", () => {
    // 2026-08-10 10:00 UTC is 15:30 IST on the same calendar day.
    const now = new Date("2026-08-10T10:00:00.000Z");
    const start = startOfDayInTimezone("Asia/Kolkata", now);
    expect(start.toISOString()).toBe("2026-08-09T18:30:00.000Z");
  });

  it("rolls over to the next IST calendar day correctly", () => {
    // 2026-08-10 20:00 UTC is 2026-08-11 01:30 IST -- already the next day.
    const now = new Date("2026-08-10T20:00:00.000Z");
    const start = startOfDayInTimezone("Asia/Kolkata", now);
    expect(start.toISOString()).toBe("2026-08-10T18:30:00.000Z");
  });

  it("returns midnight UTC as-is for the UTC timezone", () => {
    const now = new Date("2026-08-10T10:00:00.000Z");
    const start = startOfDayInTimezone("UTC", now);
    expect(start.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});
