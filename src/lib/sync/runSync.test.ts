import { beforeEach, describe, expect, test, vi } from "vitest";

let fetchLinkedInAlertsMock: any;
let fetchMessageContentMock: any;
let parseLinkedInAlertMock: any;
let fromMock: any;
let insertMock: any;

vi.mock("@/lib/gmail/fetchLinkedInAlerts", () => ({
  fetchLinkedInAlerts: (...args: any[]) => fetchLinkedInAlertsMock(...args),
}));
vi.mock("@/lib/gmail/fetchMessageContent", () => ({
  fetchMessageContent: (...args: any[]) => fetchMessageContentMock(...args),
}));
vi.mock("@/lib/parsers/linkedin", () => ({
  parseLinkedInAlert: (...args: any[]) => parseLinkedInAlertMock(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { runSync, SyncDatabaseError } from "./runSync";

function upsertTable(result: { data: unknown; error: unknown }) {
  return { upsert: () => ({ select: () => Promise.resolve(result) }) };
}

function syncRunsTable() {
  return { insert: insertMock };
}

beforeEach(() => {
  fetchLinkedInAlertsMock = vi.fn();
  fetchMessageContentMock = vi.fn();
  parseLinkedInAlertMock = vi.fn();
  fromMock = vi.fn();
  insertMock = vi.fn();
  vi.clearAllMocks();
  insertMock.mockResolvedValue({ error: null });
});

describe("runSync success", () => {
  test("writes one ok sync_runs row with matching counts and returns the same result", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: [{ id: 1 }], error: null })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([{ id: "m1", threadId: "t1", date: "", subject: "" }]);
    fetchMessageContentMock.mockResolvedValue({ id: "m1", internalDate: "1000", text: "body" });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [],
      failures: [],
    });

    const result = await runSync("cron");

    expect(result).toEqual({
      messages: 1,
      cards: 1,
      unique: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      trigger: "cron",
      status: "ok",
      messages: 1,
      cards: 1,
      unique_jobs: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parser_failure_count: 0,
      parser_failures: [],
      failures: [],
      error: null,
    });
    expect(row.started_at).toBeTypeOf("string");
    expect(row.finished_at).toBeTypeOf("string");
  });
});

describe("runSync crash before any message is fetched", () => {
  test("writes exactly one error sync_runs row with null counts and rethrows", async () => {
    fromMock.mockImplementation(() => syncRunsTable());
    fetchLinkedInAlertsMock.mockRejectedValue(new Error("gmail unreachable"));

    await expect(runSync("cron")).rejects.toThrow("gmail unreachable");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      trigger: "cron",
      status: "error",
      messages: null,
      cards: null,
      unique_jobs: null,
      inserted: null,
      skipped: null,
      warnings: null,
      parser_failure_count: null,
      parser_failures: [],
      failures: [],
      error: "gmail unreachable",
    });
  });
});

describe("runSync database upsert failure", () => {
  test("writes one error sync_runs row and throws SyncDatabaseError", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: null, error: { message: "duplicate key" } })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([{ id: "m1", threadId: "t1", date: "", subject: "" }]);
    fetchMessageContentMock.mockResolvedValue({ id: "m1", internalDate: "1000", text: "body" });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [],
      failures: [],
    });

    await expect(runSync("manual")).rejects.toBeInstanceOf(SyncDatabaseError);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      trigger: "manual",
      status: "error",
      messages: null,
      error: "duplicate key",
    });
  });
});

describe("runSync when the sync_runs insert itself fails", () => {
  test("logs the error but still returns the sync result", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: [], error: null })
        : { insert: () => Promise.resolve({ error: { message: "insert failed" } }) }
    );
    fetchLinkedInAlertsMock.mockResolvedValue([]);

    const result = await runSync("cron");

    expect(result.messages).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
