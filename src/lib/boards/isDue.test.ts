import { describe, expect, test } from "vitest";
import { isDue } from "./isDue";
import type { BoardCheck, CheckStatus } from "./types";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function check(status: CheckStatus, ageMs = 0): BoardCheck {
  return { boardId: 1, status, jobCount: null, checkedAt: new Date(NOW.getTime() - ageMs).toISOString() };
}

describe("isDue", () => {
  test("no check row is due", () => expect(isDue(undefined, NOW)).toBe("due"));
  test("active is due", () => expect(isDue(check("active", 100 * DAY), NOW)).toBe("due"));
  test("not_found is due", () => expect(isDue(check("not_found", 0), NOW)).toBe("due"));
  test("dead is dead", () => expect(isDue(check("dead", 100 * DAY), NOW)).toBe("dead"));
  test("empty at 13 days 23 h is not due", () =>
    expect(isDue(check("empty", 14 * DAY - 60 * 60 * 1000), NOW)).toBe("not_due"));
  test("empty at exactly 14 days is due", () => expect(isDue(check("empty", 14 * DAY), NOW)).toBe("due"));
  test("empty at 15 days is due", () => expect(isDue(check("empty", 15 * DAY), NOW)).toBe("due"));
});
