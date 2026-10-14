import { beforeEach, describe, expect, test, vi } from "vitest";

let fetchLinkedInAlertsMock: any;
let fetchMessageContentMock: any;
let parseLinkedInAlertMock: any;
let fromMock: any;
let insertMock: any;
let fetchBoardJobsMock: any;
let upsertMock: any;

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

vi.mock("@/lib/greenhouse/fetchBoard", () => ({
  fetchBoardJobs: (...args: any[]) => fetchBoardJobsMock(...args),
}));
vi.mock("@/config/greenhouseBoards", () => ({
  GREENHOUSE_BOARDS: [
    { identifier: "alpha", displayName: "Alpha" },
    { identifier: "beta", displayName: "Beta" },
  ],
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
  fetchBoardJobsMock = vi.fn();
  upsertMock = vi.fn();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
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
      warnings: [{ reason: "unrecognized extra line inside card", snippet: "extra", jobId: "1" }],
      failures: [],
    });

    const result = await runSync("cron");

    expect(result).toEqual({
      messages: 1,
      cards: 1,
      unique: 1,
      inserted: 1,
      skipped: 0,
      warnings: 1,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
      warningDetails: [{ messageId: "m1", jobId: "1", reason: "unrecognized extra line inside card" }],
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
      warnings: 1,
      parser_failure_count: 0,
      parser_failures: [],
      failures: [],
      warning_details: [{ messageId: "m1", jobId: "1", reason: "unrecognized extra line inside card" }],
      error: null,
    });
    expect(row.started_at).toBeTypeOf("string");
    expect(row.finished_at).toBeTypeOf("string");
  });

  test("some individual messages fail, overall run still succeeds", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: [{ id: 1 }], error: null })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([
      { id: "m1", threadId: "t1", date: "", subject: "" },
      { id: "m2", threadId: "t2", date: "", subject: "" },
    ]);
    fetchMessageContentMock.mockImplementation((id: string) => {
      if (id === "m2") return Promise.reject(new Error("fetch timeout"));
      return Promise.resolve({ id: "m1", internalDate: "1000", text: "body" });
    });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [],
      failures: [],
    });

    const result = await runSync("cron");

    expect(result.inserted).toBe(1);
    expect(result.failures).toEqual([{ messageId: "m2", jobId: null, reason: "fetch timeout" }]);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      status: "ok",
      inserted: 1,
      failures: [{ messageId: "m2", jobId: null, reason: "fetch timeout" }],
    });
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
      failures: [{ messageId: "gmail", jobId: null, reason: "gmail unreachable" }],
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

describe("runSync crash after partial message failures", () => {
  test("error row holds the failures collected before the crash plus the crash error", async () => {
    fromMock.mockImplementation((table: string) =>
      table === "vacancies"
        ? upsertTable({ data: null, error: { message: "duplicate key" } })
        : syncRunsTable()
    );
    fetchLinkedInAlertsMock.mockResolvedValue([
      { id: "m1", threadId: "t1", date: "", subject: "" },
      { id: "m2", threadId: "t2", date: "", subject: "" },
      { id: "m3", threadId: "t3", date: "", subject: "" },
    ]);
    fetchMessageContentMock.mockImplementation((id: string) => {
      if (id === "m1") return Promise.reject(new Error("fetch timeout"));
      if (id === "m2") return Promise.reject(new Error("message not found"));
      return Promise.resolve({ id: "m3", internalDate: "1000", text: "body" });
    });
    parseLinkedInAlertMock.mockReturnValue({
      cards: [{ jobId: "1", title: "Widget Engineer", company: "Acme", location: "Remote", url: "https://x" }],
      warnings: [{ reason: "unrecognized extra line inside card", snippet: "extra", jobId: "1" }],
      failures: [],
    });

    await expect(runSync("cron")).rejects.toBeInstanceOf(SyncDatabaseError);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0];
    expect(row).toMatchObject({
      status: "error",
      messages: null,
      error: "duplicate key",
      parser_failures: [],
      failures: [
        { messageId: "m1", reason: "fetch timeout" },
        { messageId: "m2", reason: "message not found" },
      ],
      warning_details: [{ messageId: "m3", jobId: "1", reason: "unrecognized extra line inside card" }],
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

describe("runSync Greenhouse step", () => {
  const job = (id: number, title = "Product Manager", location = "Kuala Lumpur, Malaysia") => ({
    id,
    title,
    location: { name: location },
    absolute_url: `https://gh/${id}`,
  });

  function setup(upsertResult: { data: unknown; error: unknown } = { data: [{ id: 1 }], error: null }) {
    fetchLinkedInAlertsMock.mockResolvedValue([]);
    upsertMock.mockReturnValue({ select: () => Promise.resolve(upsertResult) });
    fromMock.mockImplementation((table: string) =>
      table === "vacancies" ? { upsert: upsertMock } : syncRunsTable()
    );
  }

  test("skipped when the env var is unset or not exactly true", async () => {
    setup();
    for (const value of [undefined, "", "TRUE", "1"]) {
      vi.stubEnv("GREENHOUSE_SYNC_ENABLED", value as string);
      const result = await runSync("cron");
      expect(result.failures).toEqual([]);
    }
    expect(fetchBoardJobsMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test("one board failing does not stop the other and is a soft failure", async () => {
    vi.stubEnv("GREENHOUSE_SYNC_ENABLED", "true");
    setup();
    fetchBoardJobsMock.mockImplementation((board: { identifier: string }) =>
      board.identifier === "alpha" ? Promise.reject(new Error("HTTP 503")) : Promise.resolve([job(1)])
    );

    const result = await runSync("cron");

    expect(result.failures).toEqual([{ messageId: "greenhouse:alpha", jobId: null, reason: "HTTP 503" }]);
    expect(result).toMatchObject({ messages: 0, cards: 0, unique: 1, inserted: 1, skipped: 0 });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        source: "greenhouse",
        source_job_id: "1",
        company: "Beta",
        source_message_id: null,
      }),
    ]);
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: "ok", inserted: 1 });
  });

  test("invalid jobs become soft failures for their board and only passing jobs are written", async () => {
    vi.stubEnv("GREENHOUSE_SYNC_ENABLED", "true");
    setup();
    fetchBoardJobsMock.mockImplementation((board: { identifier: string }) =>
      Promise.resolve(
        board.identifier === "alpha"
          ? [job(1), job(1), job(2, "Software Engineer"), { id: 3, title: "Product Manager" }]
          : []
      )
    );

    const result = await runSync("cron");

    expect(result.failures).toEqual([
      { messageId: "greenhouse:alpha", jobId: "3", reason: "job missing absolute_url" },
    ]);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  test("a second sync adds nothing", async () => {
    vi.stubEnv("GREENHOUSE_SYNC_ENABLED", "true");
    setup();
    fetchBoardJobsMock.mockImplementation((board: { identifier: string }) =>
      Promise.resolve(board.identifier === "alpha" ? [job(1), job(2)] : [])
    );

    const first = await runSync("cron");
    expect(first).toMatchObject({ unique: 2, inserted: 1 });

    setup({ data: [], error: null });
    const second = await runSync("cron");

    expect(second).toMatchObject({ unique: 2, inserted: 0, skipped: 2 });
    expect(upsertMock).toHaveBeenLastCalledWith(expect.any(Array), {
      onConflict: "source,source_job_id",
      ignoreDuplicates: true,
    });
  });

  test("Gmail crash still runs Greenhouse, then records an error and rethrows", async () => {
    vi.stubEnv("GREENHOUSE_SYNC_ENABLED", "true");
    setup();
    fetchLinkedInAlertsMock.mockRejectedValue(new Error("gmail unreachable"));
    fetchBoardJobsMock.mockResolvedValue([job(1)]);

    await expect(runSync("cron")).rejects.toThrow("gmail unreachable");

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      status: "error",
      error: "gmail unreachable",
      inserted: 2,
      failures: [{ messageId: "gmail", jobId: null, reason: "gmail unreachable" }],
    });
  });

  test("Greenhouse database error throws SyncDatabaseError and logs counts so far", async () => {
    vi.stubEnv("GREENHOUSE_SYNC_ENABLED", "true");
    setup({ data: null, error: { message: "duplicate key" } });
    fetchBoardJobsMock.mockResolvedValue([job(1)]);

    await expect(runSync("cron")).rejects.toBeInstanceOf(SyncDatabaseError);

    expect(insertMock.mock.calls[0][0]).toMatchObject({
      status: "error",
      error: "duplicate key",
      messages: 0,
      unique_jobs: 0,
    });
  });
});
