import { describe, expect, test } from "vitest";
import { getSyncStatus } from "./syncStatus";
import type { SyncRunRecord } from "./syncRunRecord";

function run(overrides: Partial<SyncRunRecord> = {}): SyncRunRecord {
  return {
    id: 1, runId: null, trigger: "cron", status: "ok",
    startedAt: "2026-10-06T11:00:00.000Z", finishedAt: "2026-10-06T11:05:00.000Z",
    messages: 2, cards: 3, uniqueJobs: 3, inserted: 3, skipped: 0, warnings: 0,
    parserFailureCount: 0, sourceResults: null, parserFailures: [], failures: [],
    warningDetails: [], error: null,
    ...overrides,
  };
}
const detail = { messageId: "m", jobId: null, reason: "r", source: "linkedin" as const };

describe("getSyncStatus", () => {
  test("ok when clean, also with null counts", () => {
    expect(getSyncStatus(run())).toBe("ok");
    expect(getSyncStatus(run({ warnings: null, parserFailureCount: null }))).toBe("ok");
  });
  test("error wins over everything", () => {
    expect(getSyncStatus(run({ status: "error", failures: [detail] }))).toBe("error");
  });
  test.each([
    ["failures", { failures: [detail] }],
    ["warnings count", { warnings: 1 }],
    ["parser failure count", { parserFailureCount: 1 }],
    ["parser failure list", { parserFailures: [detail] }],
    ["warning detail list", { warningDetails: [detail] }],
  ])("warning for %s", (_name, overrides) => {
    expect(getSyncStatus(run(overrides as Partial<SyncRunRecord>))).toBe("warning");
  });
});
