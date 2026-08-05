import { randomBytes } from "node:crypto";

export function generateSecureToken(length = 32): string {
  const bytes = randomBytes(length);
  return bytes.toString("hex");
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
