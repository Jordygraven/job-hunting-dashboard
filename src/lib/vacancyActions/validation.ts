import { isDateNotInFutureKl, isValidDateString } from "@/lib/format/kualaLumpurDate";
import type { IgnoreReason } from "./types";

export const IGNORE_REASONS = ["language", "location", "seniority", "other"] as const satisfies readonly IgnoreReason[];

export const REASON_LABELS: Record<(typeof IGNORE_REASONS)[number], string> = {
  language: "Language",
  location: "Location",
  seniority: "Seniority",
  other: "Other",
};

export function isValidVacancyId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isValidIgnoreReason(value: unknown): value is IgnoreReason {
  return typeof value === "string" && (IGNORE_REASONS as readonly string[]).includes(value);
}

export function isValidAppliedOnDate(value: unknown, now: Date = new Date()): value is string {
  return typeof value === "string" && isValidDateString(value) && isDateNotInFutureKl(value, now);
}
