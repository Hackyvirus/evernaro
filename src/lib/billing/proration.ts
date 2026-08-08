"server-only";
import type { CustomerSubscription } from "@prisma/client";

function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function calculateProration(
  current: CustomerSubscription,
  newTotalInr: number
): { creditInr: number; debitInr: number; netInr: number } {
  const now = new Date();
  const periodStart = current.currentPeriodStart ?? now;
  const periodEnd = current.currentPeriodEnd ?? now;
  if (periodEnd <= periodStart) {
    return { creditInr: 0, debitInr: newTotalInr, netInr: newTotalInr };
  }

  const totalDays = daysBetween(periodStart, periodEnd);
  const remainingDays = Math.max(0, daysBetween(now, periodEnd));
  const oldDaily = current.totalAmountInr / totalDays;
  const newDaily = newTotalInr / totalDays;

  const creditInr = Math.round(oldDaily * remainingDays);
  const debitInr = Math.round(newDaily * remainingDays);
  return { creditInr, debitInr, netInr: debitInr - creditInr };
}
