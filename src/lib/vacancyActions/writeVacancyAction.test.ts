import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;
let insertMock: any;
let getSupabaseServerClientMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: (...args: any[]) => getSupabaseServerClientMock(...args),
}));

import { writeVacancyAction } from "./writeVacancyAction";

function vacanciesTable(result: { data: unknown; error: unknown }) {
  const maybeSingleMock = vi.fn(() => Promise.resolve(result));
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  return { table: { select: () => ({ eq: eqMock }) }, eqMock, maybeSingleMock };
}

function vacancyActionsTable(fetchResult: { data: unknown; error: unknown }) {
  const orderMock = vi.fn(() => Promise.resolve(fetchResult));
  const eqMock = vi.fn(() => ({ order: orderMock }));
  return {
    table: { select: () => ({ eq: eqMock }), insert: (row: unknown) => insertMock(row) },
    eqMock,
    orderMock,
  };
}

function mockTables({
  vacancy = { data: { id: 1 }, error: null },
  actionRows = { data: [], error: null },
  insertResult = { error: null },
}: {
  vacancy?: { data: unknown; error: unknown };
  actionRows?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
} = {}) {
  insertMock.mockResolvedValue(insertResult);
  const vacancies = vacanciesTable(vacancy);
  const actions = vacancyActionsTable(actionRows);
  fromMock.mockImplementation((table: string) => (table === "vacancies" ? vacancies.table : actions.table));
  getSupabaseServerClientMock.mockImplementation(() => ({ from: fromMock }));
  return { vacancies, actions };
}

beforeEach(() => {
  fromMock = vi.fn();
  insertMock = vi.fn();
  getSupabaseServerClientMock = vi.fn(() => ({ from: fromMock }));
});

describe("writeVacancyAction validation", () => {
  test("rejects a non-integer or non-positive vacancyId before touching the database", async () => {
    const result = await writeVacancyAction({ intent: "apply", vacancyId: -1 });
    expect(result).toEqual({ ok: false, error: "Invalid vacancy." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("rejects an ignore reason outside the allowed list", async () => {
    mockTables();
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "salary" as any });
    expect(result).toEqual({ ok: false, error: "Invalid ignore reason." });
  });

  test("rejects an invalid or future editAppliedDate date", async () => {
    mockTables();
    const badFormat = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "not-a-date" });
    expect(badFormat).toEqual({ ok: false, error: "Invalid date." });
  });
});

describe("writeVacancyAction client failure", () => {
  test("returns a safe message instead of rejecting when getSupabaseServerClient throws", async () => {
    getSupabaseServerClientMock.mockImplementation(() => {
      throw new Error("Missing required environment variable: SUPABASE_URL");
    });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("writeVacancyAction vacancy existence", () => {
  test("rejects a vacancyId that doesn't exist", async () => {
    const { vacancies } = mockTables({ vacancy: { data: null, error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 999 });
    expect(result).toEqual({ ok: false, error: "Vacancy not found." });
    expect(vacancies.eqMock).toHaveBeenCalledWith("id", 999);
  });

  test("returns a safe message when the existence check itself fails", async () => {
    mockTables({ vacancy: { data: null, error: { message: "connection refused" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});

describe("writeVacancyAction guards", () => {
  test("apply is rejected when already applied", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Already marked as applied." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("ignore is rejected when already ignored", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "language" });
    expect(result).toEqual({ ok: false, error: "Already marked as ignored." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("undo is rejected when already todo (no rows)", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "undo", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Nothing to undo." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("editAppliedDate is rejected unless currently applied", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const todo = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(todo).toEqual({ ok: false, error: "Can only edit the date once applied." });
    expect(insertMock).not.toHaveBeenCalled();

    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const ignored = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(ignored).toEqual({ ok: false, error: "Can only edit the date once applied." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("writeVacancyAction success paths", () => {
  test("apply from todo inserts an applied row dated today in KL", async () => {
    const { actions } = mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(actions.eqMock).toHaveBeenCalledWith("vacancy_id", 1);
    expect(actions.orderMock).toHaveBeenCalledWith("id", { ascending: true });
    expect(insertMock).toHaveBeenCalledWith({
      vacancy_id: 1,
      action: "applied",
      applied_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  test("apply from ignored is allowed (re-applying after ignoring)", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
  });

  test("ignore with no reason inserts a null ignore_reason", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "ignored", ignore_reason: null });
  });

  test("ignore with a reason inserts it", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "seniority" });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "ignored", ignore_reason: "seniority" });
  });

  test("undo from applied inserts a reset row with no applied_on or ignore_reason", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "undo", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "reset" });
  });

  test("editAppliedDate while applied inserts a new applied row with the given date", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-03" });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "applied", applied_on: "2026-10-03" });
  });

  test("editAppliedDate is a no-op when the date matches the current applied date", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(result).toEqual({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("writeVacancyAction database failures", () => {
  test("returns a safe message when fetching current action rows fails", async () => {
    mockTables({ actionRows: { data: null, error: { message: "connection refused" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  test("returns a safe message when the insert fails", async () => {
    mockTables({ actionRows: { data: [], error: null }, insertResult: { error: { message: "constraint violation" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
