import crypto from "node:crypto";

/**
 * Convert an arbitrary string into a signed 64-bit integer suitable for
 * Postgres advisory locks (pg_advisory_xact_lock takes a signed bigint, and
 * Prisma's raw-query bigint parameter marshaling only round-trips the signed
 * 64-bit range). This previously used `asUintN`, which produces the full
 * unsigned 0..2^64-1 range — roughly half of all hash outputs landed above
 * the signed max (2^63-1) and broke every caller with "Could not convert
 * from `JSON bigint value` to `PrismaValue`" at the Prisma Client layer,
 * before the query ever reached Postgres. The lock is just an opaque 64-bit
 * key space, so a negative value works exactly as well as a positive one.
 */
export function bigintAdvisoryKey(input: string): bigint {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const slice = hash.slice(0, 16);
  return BigInt.asIntN(64, BigInt(`0x${slice}`));
}
