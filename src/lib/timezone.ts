/**
 * Convert a calendar date + wall-clock time in a specific IANA timezone
 * into an ISO 8601 UTC string.
 *
 * This avoids the browser-local timezone bug where `new Date(`${date}T${time}`)`
 * interprets the input in the customer's timezone instead of the business's
 * timezone.
 */
export function toZonedISO(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    throw new Error("Invalid date or time");
  }

  // Desired wall-clock timestamp if the date/time were already UTC.
  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute);

  // Return the offset (ms) between the UTC timestamp and the wall-clock time
  // that the target timezone displays for that UTC instant.
  function offsetAt(utcMs: number): number {
    const d = new Date(utcMs);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const localWallMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return localWallMs - utcMs;
  }

  // Iteratively refine to handle DST transitions and rounding.
  let offset = offsetAt(desiredWallMs);
  let utcMs = desiredWallMs - offset;
  offset = offsetAt(utcMs);
  utcMs = desiredWallMs - offset;

  return new Date(utcMs).toISOString();
}

/**
 * Format an instant as a calendar date ("Fri, 28 Aug") in a specific IANA
 * timezone. Server processes (the reminder worker, Vercel functions) run in
 * UTC, so `Date#toLocaleDateString` without an explicit zone renders the
 * wrong day for evening appointments -- always pass the org's timezone.
 */
export function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Format an instant as a wall-clock time ("03:30 pm") in a specific IANA timezone. */
export function formatTimeInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * The UTC instant corresponding to midnight "today" in the given timezone,
 * as of `now`. Used to scope per-day counters (e.g. queue token numbering)
 * to the business's own calendar day rather than the server's UTC day.
 */
export function startOfDayInTimezone(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  return new Date(toZonedISO(dateStr, "00:00", timeZone));
}
