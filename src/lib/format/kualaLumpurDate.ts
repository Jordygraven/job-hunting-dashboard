const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

// en-CA formats as YYYY-MM-DD, which is what we want to persist/compare.
const klDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getKlDateString(date: Date = new Date()): string {
  return klDateFormatter.format(date);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isDateNotInFutureKl(dateString: string, now: Date = new Date()): boolean {
  return dateString <= getKlDateString(now);
}
