import type { ReminderRecurrence } from "@prisma/client";

export function nextOccurrence(from: Date, recurrence: ReminderRecurrence): Date | null {
  const next = new Date(from);
  switch (recurrence) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      return next;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      return next;
    case "MONTHLY": {
      const targetMonth = next.getMonth() + 1;
      next.setMonth(targetMonth);
      // Date.setMonth overflows into the month after target when `from`'s
      // day doesn't exist there (e.g. Jan 31 -> Mar 3, silently skipping
      // Feb entirely). Clamp back to the target month's last valid day
      // instead of letting the date silently drift forward every cycle.
      const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;
      if (next.getMonth() !== normalizedTargetMonth) {
        next.setDate(0); // day 0 = the last day of the previous (i.e. intended target) month
      }
      return next;
    }
    default:
      return null;
  }
}
