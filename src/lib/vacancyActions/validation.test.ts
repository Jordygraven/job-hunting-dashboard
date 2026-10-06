import { describe, expect, test } from "vitest";
import { IGNORE_REASONS, isValidAppliedOnDate, isValidIgnoreReason, isValidVacancyId } from "./validation";

describe("isValidVacancyId", () => {
  test("accepts a positive integer", () => {
    expect(isValidVacancyId(1)).toBe(true);
    expect(isValidVacancyId(42)).toBe(true);
  });

  test("rejects zero, negatives, non-integers, and non-numbers", () => {
    expect(isValidVacancyId(0)).toBe(false);
    expect(isValidVacancyId(-1)).toBe(false);
    expect(isValidVacancyId(1.5)).toBe(false);
    expect(isValidVacancyId("1")).toBe(false);
    expect(isValidVacancyId(null)).toBe(false);
    expect(isValidVacancyId(undefined)).toBe(false);
  });
});

describe("isValidIgnoreReason", () => {
  test("accepts each allowed reason", () => {
    expect(isValidIgnoreReason("language")).toBe(true);
    expect(isValidIgnoreReason("location")).toBe(true);
    expect(isValidIgnoreReason("seniority")).toBe(true);
    expect(isValidIgnoreReason("other")).toBe(true);
  });

  test("rejects anything outside the allowed list", () => {
    expect(isValidIgnoreReason("salary")).toBe(false);
    expect(isValidIgnoreReason("")).toBe(false);
    expect(isValidIgnoreReason(null)).toBe(false);
    expect(isValidIgnoreReason(undefined)).toBe(false);
  });
});

describe("isValidAppliedOnDate", () => {
  test("accepts a valid, non-future KL date string", () => {
    const now = new Date("2026-10-06T10:00:00.000Z");
    expect(isValidAppliedOnDate("2026-10-06", now)).toBe(true);
    expect(isValidAppliedOnDate("2026-10-01", now)).toBe(true);
  });

  test("rejects malformed date strings", () => {
    const now = new Date("2026-10-06T10:00:00.000Z");
    expect(isValidAppliedOnDate("not-a-date", now)).toBe(false);
    expect(isValidAppliedOnDate("2026-02-30", now)).toBe(false);
    expect(isValidAppliedOnDate(null, now)).toBe(false);
  });

  test("rejects a date in the future in KL", () => {
    const now = new Date("2026-10-05T20:00:00.000Z"); // already 2026-10-06 in KL
    expect(isValidAppliedOnDate("2026-10-07", now)).toBe(false);
  });
});

describe("IGNORE_REASONS", () => {
  test("exports exactly the four allowed reasons", () => {
    expect(IGNORE_REASONS).toEqual(["language", "location", "seniority", "other"]);
  });
});
