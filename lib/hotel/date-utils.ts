import { AppError } from "../api-response";

/**
 * Parses a "YYYY-MM-DD" string into a UTC Date object at 00:00:00.000.
 */
export function parseDateOnly(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    const y = dateInput.getUTCFullYear();
    const m = dateInput.getUTCMonth();
    const d = dateInput.getUTCDate();
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }

  const parts = dateInput.split("-");
  if (parts.length !== 3) {
    throw new AppError("Invalid date format, expected YYYY-MM-DD", 400, "INVALID_DATE_FORMAT");
  }
  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10) - 1;
  const day = Number.parseInt(parts[2], 10);

  const parsed = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Invalid calendar date", 400, "INVALID_DATE");
  }
  return parsed;
}

/**
 * Formats a Date object into "YYYY-MM-DD".
 */
export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calculates number of nights between checkIn and checkOut.
 * Enforces checkOut > checkIn.
 */
export function calculateStayNights(checkInInput: string | Date, checkOutInput: string | Date): number {
  const checkIn = parseDateOnly(checkInInput);
  const checkOut = parseDateOnly(checkOutInput);

  const diffMs = checkOut.getTime() - checkIn.getTime();
  if (diffMs <= 0) {
    throw new AppError("Check-out date must be strictly after check-in date", 400, "INVALID_STAY_DATES");
  }

  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return nights;
}

/**
 * Returns an array of "YYYY-MM-DD" date strings for each night of the stay.
 * A 3-night stay from 2026-12-01 to 2026-12-04 returns:
 * ['2026-12-01', '2026-12-02', '2026-12-03']
 */
export function getStayNightDates(checkInInput: string | Date, checkOutInput: string | Date): string[] {
  const checkIn = parseDateOnly(checkInInput);
  const checkOut = parseDateOnly(checkOutInput);
  const nights = calculateStayNights(checkIn, checkOut);

  const dates: string[] = [];
  const current = new Date(checkIn.getTime());

  for (let i = 0; i < nights; i++) {
    dates.push(formatDateOnly(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Returns hours between now (or reference date) and checkIn arrival timestamp.
 * Standard hotel check-in time (e.g. "14:00") is applied to the check-in date.
 */
export function getHoursUntilCheckIn(
  checkInDate: Date | string,
  standardCheckInTime = "14:00",
  now: Date = new Date()
): number {
  const checkIn = parseDateOnly(checkInDate);
  const [hours, minutes] = standardCheckInTime.split(":").map((v) => Number.parseInt(v, 10));

  const checkInTimestamp = new Date(
    Date.UTC(
      checkIn.getUTCFullYear(),
      checkIn.getUTCMonth(),
      checkIn.getUTCDate(),
      hours || 14,
      minutes || 0,
      0,
      0
    )
  );

  const diffMs = checkInTimestamp.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
}
