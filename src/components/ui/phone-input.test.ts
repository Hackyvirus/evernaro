import { describe, it, expect } from "vitest";
import { splitE164 } from "./phone-input";

describe("splitE164", () => {
  it("splits a standard Indian E.164 number", () => {
    expect(splitE164("+919876543210")).toEqual({ countryCode: "91", national: "9876543210" });
  });

  it("defaults to India for a bare national number with no country code", () => {
    expect(splitE164("9876543210")).toEqual({ countryCode: "91", national: "9876543210" });
  });

  it("handles an empty value", () => {
    expect(splitE164("")).toEqual({ countryCode: "91", national: "" });
  });

  it("does not let a 1-digit country code shadow-match a 3-digit one", () => {
    // "971..." must resolve to UAE (971), not US/Canada (1) matching its
    // leading digit and leaving "71..." as the national number.
    expect(splitE164("+971501234567")).toEqual({ countryCode: "971", national: "501234567" });
  });

  it("splits a US number correctly", () => {
    expect(splitE164("+14155551234")).toEqual({ countryCode: "1", national: "4155551234" });
  });
});
