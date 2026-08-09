export type BusinessHoursEntry = {
  day: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  open: string; // "HH:mm"
  close: string; // "HH:mm"
};

const WEEKDAY_SHORT_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursEntry[] = [
  { day: 1, open: "10:00", close: "20:00" },
  { day: 2, open: "10:00", close: "20:00" },
  { day: 3, open: "10:00", close: "20:00" },
  { day: 4, open: "10:00", close: "20:00" },
  { day: 5, open: "10:00", close: "20:00" },
  { day: 6, open: "10:00", close: "20:00" },
];

function parseBusinessHours(value: unknown): BusinessHoursEntry[] {
  if (!value) return DEFAULT_BUSINESS_HOURS;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return DEFAULT_BUSINESS_HOURS;
    return parsed
      .filter(
        (entry): entry is BusinessHoursEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.day === "number" &&
          typeof entry.open === "string" &&
          typeof entry.close === "string"
      )
      .map((entry) => ({ day: entry.day, open: entry.open, close: entry.close }));
  } catch {
    return DEFAULT_BUSINESS_HOURS;
  }
}

function getOrgLocalTimeParts(date: Date, timezone: string) {
  const weekday = date.toLocaleDateString("en-US", { timeZone: timezone, weekday: "short" });
  const time = date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    day: WEEKDAY_SHORT_TO_NUMBER[weekday] ?? 0,
    time,
    timeMinutes: timeToMinutes(time),
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getHoursForDay(hours: BusinessHoursEntry[], day: number): BusinessHoursEntry | undefined {
  return hours.find((entry) => entry.day === day);
}

export function isWithinBusinessHours(
  timezone: string,
  businessHours: unknown,
  date: Date
): boolean {
  const hours = parseBusinessHours(businessHours);
  const { day, timeMinutes } = getOrgLocalTimeParts(date, timezone);
  const dayHours = getHoursForDay(hours, day);
  if (!dayHours) return false;
  const open = timeToMinutes(dayHours.open);
  const close = timeToMinutes(dayHours.close);
  return timeMinutes >= open && timeMinutes < close;
}

/**
 * Ensure the entire appointment interval lies inside business hours on a single
 * day. Prevents slots that start open but end after close, or cross a closed day.
 */
export function isAppointmentWithinBusinessHours(
  timezone: string,
  businessHours: unknown,
  startsAt: Date,
  endsAt: Date
): boolean {
  const hours = parseBusinessHours(businessHours);
  const startParts = getOrgLocalTimeParts(startsAt, timezone);
  const endParts = getOrgLocalTimeParts(endsAt, timezone);
  if (startParts.day !== endParts.day) return false;
  const dayHours = getHoursForDay(hours, startParts.day);
  if (!dayHours) return false;
  const open = timeToMinutes(dayHours.open);
  const close = timeToMinutes(dayHours.close);
  return startParts.timeMinutes >= open && endParts.timeMinutes <= close;
}

export function isBusinessOpen(timezone: string, businessHours: unknown, now = new Date()): boolean {
  return isWithinBusinessHours(timezone, businessHours, now);
}

export function formatBusinessStatus(
  timezone: string,
  businessHours: unknown,
  now = new Date()
): { open: boolean; message: string } {
  const hours = parseBusinessHours(businessHours);
  const { day, timeMinutes } = getOrgLocalTimeParts(now, timezone);
  const dayHours = getHoursForDay(hours, day);

  if (dayHours) {
    const open = timeToMinutes(dayHours.open);
    const close = timeToMinutes(dayHours.close);
    if (timeMinutes >= open && timeMinutes < close) {
      return { open: true, message: `Open until ${formatTime(dayHours.close)}` };
    }
    if (timeMinutes < open) {
      return { open: false, message: `Opens today at ${formatTime(dayHours.open)}` };
    }
  }

  // Find next opening time within the next 14 days.
  for (let offset = 1; offset <= 14; offset++) {
    const nextDay = (day + offset) % 7;
    const nextHours = getHoursForDay(hours, nextDay);
    if (nextHours) {
      return { open: false, message: `Opens ${dayName(nextDay)} at ${formatTime(nextHours.open)}` };
    }
  }

  return { open: false, message: "Currently closed" };
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function dayName(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}
