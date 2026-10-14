import { describe, expect, test } from "vitest";
import { groupRunProblems } from "./groupRunProblems";
import type { ResolvedSyncRunDetail, SyncRunRecord } from "./syncRunRecord";

const li = (messageId: string): ResolvedSyncRunDetail => ({ messageId, jobId: null, reason: "r", source: "linkedin" });
const gh = (board: string): ResolvedSyncRunDetail => ({ messageId: board, jobId: null, reason: "r", source: "greenhouse", board });

function run(overrides: Partial<SyncRunRecord>): SyncRunRecord {
  return {
    id: 1, runId: null, trigger: "cron", status: "ok",
    startedAt: "x", finishedAt: "x", messages: 0, cards: 0, uniqueJobs: 0, inserted: 0, skipped: 0,
    warnings: 0, parserFailureCount: 0, sourceResults: null, parserFailures: [], failures: [],
    warningDetails: [], error: null,
    ...overrides,
  };
}

describe("groupRunProblems", () => {
  test("groups by source and board, LinkedIn first", () => {
    const result = groupRunProblems(
      run({ failures: [gh("bybit"), li("m1"), gh("other")], parserFailures: [li("m2")], warningDetails: [li("m3")] })
    );
    expect(result.bySource.map((g) => [g.source, g.board])).toEqual([
      ["linkedin", undefined],
      ["greenhouse", "bybit"],
      ["greenhouse", "other"],
    ]);
    expect(result.bySource[0]).toMatchObject({
      failures: [li("m1")], parserFailures: [li("m2")], warnings: [li("m3")],
    });
  });
  test("topLevel splits error on newlines and drops blanks", () => {
    expect(groupRunProblems(run({ error: "a\n\nb" })).topLevel).toEqual(["a", "b"]);
    expect(groupRunProblems(run({ error: null })).topLevel).toEqual([]);
  });
  test("no problems gives no groups", () => {
    expect(groupRunProblems(run({})).bySource).toEqual([]);
  });
});
