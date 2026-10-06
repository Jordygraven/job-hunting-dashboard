import { isDateNotInFutureKl, isValidDateString } from "@/lib/format/kualaLumpurDate";
import type { IgnoreReason } from "./types";

export const IGNORE_REASONS: readonly IgnoreReason[] = ["language", "location", "seniority", "other"];

export function isValidVacancyId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isValidIgnoreReason(value: unknown): value is IgnoreReason {
  return typeof value === "string" && (IGNORE_REASONS as readonly string[]).includes(value);
}

export function isValidAppliedOnDate(value: unknown, now: Date = new Date()): value is string {
  return typeof value === "string" && isValidDateString(value) && isDateNotInFutureKl(value, now);
}
