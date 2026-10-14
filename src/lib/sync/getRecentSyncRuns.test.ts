import { beforeEach, describe, expect, test, vi } from "vitest";
import { mapSyncRunRow } from "./getRecentSyncRuns";

let selectMock: any;
let orderMock: any;
let limitMock: any;
let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getRecentSyncRuns } from "./getRecentSyncRuns";

beforeEach(() => {
  limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
  orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  selectMock = vi.fn().mockReturnValue({ order: orderMock });
  fromMock = vi.fn().mockReturnValue({ select: selectMock });
});

function validRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    trigger: "cron",
    status: "ok",
    started_at: "2026-10-06T11:00:00.000Z",
    finished_at: "2026-10-06T11:05:00.000Z",
    messages: 2,
    cards: 3,
    unique_jobs: 3,
    inserted: 3,
    skipped: 0,
    warnings: 1,
    parser_failure_count: 0,
    parser_failures: [],
    failures: [],
    warning_details: [{ messageId: "m1", jobId: "1", reason: "unrecognized extra line inside card" }],
    error: null,
    ...overrides,
  };
}

describe("mapSyncRunRow", () => {
  test("maps a valid row to a SyncRunRecord", () => {
    expect(mapSyncRunRow(validRow())).toEqual({
      id: 1,
      runId: null,
      sourceResults: null,
      trigger: "cron",
      status: "ok",
      startedAt: "2026-10-06T11:00:00.000Z",
      finishedAt: "2026-10-06T11:05:00.000Z",
      messages: 2,
      cards: 3,
      uniqueJobs: 3,
      inserted: 3,
      skipped: 0,
      warnings: 1,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
      warningDetails: [
        { messageId: "m1", jobId: "1", reason: "unrecognized extra line inside card", source: "linkedin" },
      ],
      error: null,
    });
  });

  test("old rows: greenhouse: prefix gives source greenhouse and board, anything else is linkedin", () => {
    const row = validRow({
      failures: [
        { messageId: "greenhouse:bybit", jobId: "9", reason: "job missing title" },
        { messageId: "gmail", jobId: null, reason: "gmail unreachable" },
        { messageId: "m2", jobId: null, reason: "fetch timeout" },
      ],
    });
    expect(mapSyncRunRow(row).failures).toEqual([
      { messageId: "greenhouse:bybit", jobId: "9", reason: "job missing title", source: "greenhouse", board: "bybit" },
      { messageId: "gmail", jobId: null, reason: "gmail unreachable", source: "linkedin" },
      { messageId: "m2", jobId: null, reason: "fetch timeout", source: "linkedin" },
    ]);
  });

  test("old rows: parser failures and warnings without source map to linkedin", () => {
    const old = { messageId: "m1", jobId: "1", reason: "r" };
    const mapped = mapSyncRunRow(validRow({ parser_failures: [old], warning_details: [old] }));
    expect(mapped.parserFailures).toEqual([{ ...old, source: "linkedin" }]);
    expect(mapped.warningDetails).toEqual([{ ...old, source: "linkedin" }]);
  });

  test("new rows: stored source and board win; no prefix stripping", () => {
    const row = validRow({
      failures: [{ messageId: "bybit", jobId: null, reason: "HTTP 503", source: "greenhouse", board: "bybit" }],
    });
    expect(mapSyncRunRow(row).failures).toEqual([
      { messageId: "bybit", jobId: null, reason: "HTTP 503", source: "greenhouse", board: "bybit" },
    ]);
  });

  test("reads run_id and source_results", () => {
    const results = [{ source: "linkedin", found: 3, inserted: 2, skipped: 1, failed: 0 }];
    const mapped = mapSyncRunRow(validRow({ run_id: "abc", source_results: results }));
    expect(mapped.runId).toBe("abc");
    expect(mapped.sourceResults).toEqual(results);
  });

  test("throws on an unexpected trigger value", () => {
    expect(() => mapSyncRunRow(validRow({ trigger: "scheduled" }))).toThrow(/trigger/);
  });

  test("throws on an unexpected status value", () => {
    expect(() => mapSyncRunRow(validRow({ status: "pending" }))).toThrow(/status/);
  });

  test("passes through an old-shape row (no jobId on failures, empty warning_details) without crashing", () => {
    const oldRow = validRow({
      parser_failures: [{ messageId: "m1", reason: "card is missing a title or company" }],
      failures: [{ messageId: "m2", reason: "fetch timeout" }],
      warning_details: [],
    });

    expect(mapSyncRunRow(oldRow)).toMatchObject({
      parserFailures: [{ messageId: "m1", reason: "card is missing a title or company" }],
      failures: [{ messageId: "m2", reason: "fetch timeout" }],
      warningDetails: [],
    });
  });

  test("defaults null jsonb columns to empty arrays", () => {
    const row = validRow({ parser_failures: null, failures: null, warning_details: null });
    expect(mapSyncRunRow(row)).toMatchObject({
      parserFailures: [],
      failures: [],
      warningDetails: [],
    });
  });
});

describe("getRecentSyncRuns", () => {
  test("queries the last 10 runs ordered newest first by id", async () => {
    await getRecentSyncRuns();

    expect(fromMock).toHaveBeenCalledWith("sync_runs");
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  test("returns an empty array when there are no runs", async () => {
    expect(await getRecentSyncRuns()).toEqual([]);
  });

  test("maps each returned row", async () => {
    limitMock.mockResolvedValue({ data: [validRow(), validRow({ id: 2 })], error: null });

    const result = await getRecentSyncRuns();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  test("throws when the query errors", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "connection refused" } });

    await expect(getRecentSyncRuns()).rejects.toThrow("connection refused");
  });

  test("skips a row with an unreadable trigger/status instead of failing the whole page", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    limitMock.mockResolvedValue({
      data: [validRow({ id: 1, trigger: "scheduled" }), validRow({ id: 2 })],
      error: null,
    });

    const result = await getRecentSyncRuns();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
