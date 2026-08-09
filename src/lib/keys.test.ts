import { describe, it, expect } from "vitest";
import { bigintAdvisoryKey } from "./keys";

describe("bigintAdvisoryKey", () => {
  it("returns a positive bigint", () => {
    const key = bigintAdvisoryKey("test");
    expect(typeof key).toBe("bigint");
    expect(key >= 0n).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(bigintAdvisoryKey("same")).toBe(bigintAdvisoryKey("same"));
  });

  it("differs for different inputs", () => {
    expect(bigintAdvisoryKey("a")).not.toBe(bigintAdvisoryKey("b"));
  });
});
