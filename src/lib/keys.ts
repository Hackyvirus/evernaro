import crypto from "node:crypto";

/**
 * Convert an arbitrary string into a signed 64-bit integer suitable for
 * Postgres advisory locks. Values are folded into the positive BigInt range.
 */
export function bigintAdvisoryKey(input: string): bigint {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const slice = hash.slice(0, 16);
  return BigInt.asUintN(64, BigInt(`0x${slice}`));
}
