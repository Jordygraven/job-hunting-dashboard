import { describe, expect, test } from "vitest";
import { getKlDateString, isDateNotInFutureKl, isValidDateString } from "./kualaLumpurDate";

describe("getKlDateString", () => {
  test("formats a UTC morning timestamp as the same KL calendar day", () => {
    expect(getKlDateString(new Date("2026-10-06T01:00:00.000Z"))).toBe("2026-10-06");
  });

  test("rolls over to the next KL calendar day for a late-evening UTC timestamp", () => {
    // 2026-10-05T20:00:00Z is 2026-10-06T04:00:00 in Asia/Kuala_Lumpur (UTC+8)
    expect(getKlDateString(new Date("2026-10-05T20:00:00.000Z"))).toBe("2026-10-06");
  });

  test("defaults to the current time when no argument is given", () => {
    expect(getKlDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidDateString", () => {
  test("accepts a real calendar date in YYYY-MM-DD form", () => {
    expect(isValidDateString("2026-10-06")).toBe(true);
  });

  test("rejects a non-existent calendar date", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
  });

  test("rejects malformed strings", () => {
    expect(isValidDateString("2026-10-6")).toBe(false);
    expect(isValidDateString("06-10-2026")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });
});

describe("isDateNotInFutureKl", () => {
  test("accepts today and any past date in KL, using a fixed 'now'", () => {
    const now = new Date("2026-10-06T10:00:00.000Z"); // 2026-10-06T18:00 KL
    expect(isDateNotInFutureKl("2026-10-06", now)).toBe(true);
    expect(isDateNotInFutureKl("2026-10-05", now)).toBe(true);
  });

  test("rejects a date that is tomorrow in KL even though it's still today in UTC", () => {
    // 2026-10-05T20:00:00Z is already 2026-10-06 in KL, so 2026-10-07 is the future
    const now = new Date("2026-10-05T20:00:00.000Z");
    expect(isDateNotInFutureKl("2026-10-07", now)).toBe(false);
    expect(isDateNotInFutureKl("2026-10-06", now)).toBe(true);
  });
});
