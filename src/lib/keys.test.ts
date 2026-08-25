import { describe, it, expect } from "vitest";
import { bigintAdvisoryKey } from "./keys";

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

describe("bigintAdvisoryKey", () => {
  it("returns a bigint within Postgres's signed bigint range", () => {
    const key = bigintAdvisoryKey("test");
    expect(typeof key).toBe("bigint");
    expect(key >= INT64_MIN && key <= INT64_MAX).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(bigintAdvisoryKey("same")).toBe(bigintAdvisoryKey("same"));
  });

  it("differs for different inputs", () => {
    expect(bigintAdvisoryKey("a")).not.toBe(bigintAdvisoryKey("b"));
  });
});
