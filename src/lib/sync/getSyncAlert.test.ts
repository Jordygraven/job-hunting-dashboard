// src/lib/sync/getSyncAlert.test.ts
import { describe, expect, test } from "vitest";
import { getSyncAlert } from "./getSyncAlert";
import type { SyncRunRecord } from "./syncRunRecord";

const NOW = new Date("2026-10-06T12:00:00.000Z");

function run(overrides: Partial<SyncRunRecord> = {}): SyncRunRecord {
  return {
    trigger: "cron",
    status: "ok",
    startedAt: "2026-10-06T11:00:00.000Z",
    finishedAt: "2026-10-06T11:05:00.000Z",
    messages: 2,
    cards: 3,
    uniqueJobs: 3,
    inserted: 3,
    skipped: 0,
    warnings: 0,
    parserFailureCount: 0,
    parserFailures: [],
    failures: [],
    error: null,
    ...overrides,
  };
}

describe("getSyncAlert", () => {
  test("alerts when no run exists", () => {
    expect(getSyncAlert(null, NOW)).toEqual([{ type: "no-run" }]);
  });

  test("alerts when the latest run is older than 26 hours", () => {
    const staleRun = run({ finishedAt: "2026-10-05T09:00:00.000Z" }); // 27h before NOW
    expect(getSyncAlert(staleRun, NOW)).toEqual([
      { type: "stale", finishedAt: "2026-10-05T09:00:00.000Z" },
    ]);
  });

  test("does not alert for a fresh, ok run with no failures", () => {
    expect(getSyncAlert(run(), NOW)).toEqual([]);
  });

  test("alerts when status is error", () => {
    const errorRun = run({ status: "error", error: "gmail unreachable", messages: null, cards: null, uniqueJobs: null, inserted: null, skipped: null, warnings: null, parserFailureCount: null });
    expect(getSyncAlert(errorRun, NOW)).toEqual([
      { type: "error", error: "gmail unreachable" },
    ]);
  });

  test("alerts when failures is non-empty, including messageId and reason", () => {
    const failingRun = run({ failures: [{ messageId: "m1", reason: "fetch timeout" }] });
    expect(getSyncAlert(failingRun, NOW)).toEqual([
      { type: "failures", failures: [{ messageId: "m1", reason: "fetch timeout" }] },
    ]);
  });

  test("alerts when parser_failure_count is greater than zero", () => {
    const parserFailingRun = run({
      parserFailureCount: 1,
      parserFailures: [{ messageId: "m1", reason: "card is missing a title or company" }],
    });
    expect(getSyncAlert(parserFailingRun, NOW)).toEqual([
      {
        type: "parser-failures",
        count: 1,
        parserFailures: [{ messageId: "m1", reason: "card is missing a title or company" }],
      },
    ]);
  });

  test("does not alert when only warnings are present", () => {
    expect(getSyncAlert(run({ warnings: 5 }), NOW)).toEqual([]);
  });
});
