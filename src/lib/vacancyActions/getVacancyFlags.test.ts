import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancyFlags } from "./getVacancyFlags";
import { SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";

function actionsTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const ltMock = vi.fn();
  function builder(): any {
    const b: any = { lt: (...args: any[]) => { ltMock(...args); return b; } };
    b.then = (resolve: any, reject: any) =>
      Promise.resolve(pages[Math.min(call++, pages.length - 1)]).then(resolve, reject);
    return b;
  }
  const limitMock = vi.fn(() => builder());
  const orderMock = vi.fn(() => ({ limit: limitMock }));
  return { table: { select: () => ({ order: orderMock }) }, limitMock, orderMock, ltMock };
}

function dbRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    vacancy_id: 1,
    action: "applied",
    ignore_reason: null,
    applied_on: null,
    outcome_on: null,
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancyFlags", () => {
  test("returns an empty map when there are no action rows", async () => {
    const { table } = actionsTable([{ data: [], error: null }]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.size).toBe(0);
  });

  test("groups rows by vacancy_id and derives each vacancy's status and starred independently", async () => {
    const { table, orderMock } = actionsTable([
      {
        data: [
          dbRow({ id: 3, vacancy_id: 10, action: "reset" }),
          dbRow({ id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", created_at: "2026-10-02T00:00:00.000Z" }),
          dbRow({ id: 1, vacancy_id: 10, action: "applied", applied_on: "2026-10-01" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.get(10)).toEqual({ status: { status: "todo" }, starred: false, autoDraft: false, pilot: false, drafted: false, queued: false });
    expect(flags.get(20)).toEqual({
      status: { status: "ignored", reason: "language", date: "2026-10-02" },
      starred: false,
      autoDraft: false,
      pilot: false,
      drafted: false,
      queued: false,
    });
    expect(flags.size).toBe(2);
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("keeps every row per vacancy — status-latest and star-latest can be different rows", async () => {
    const { table } = actionsTable([
      {
        data: [
          dbRow({ id: 5, vacancy_id: 10, action: "starred" }),
          dbRow({ id: 2, vacancy_id: 10, action: "applied", applied_on: "2026-10-02" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.get(10)).toEqual({
      status: { status: "applied", appliedOn: "2026-10-02" },
      starred: true,
      autoDraft: false,
      pilot: false,
      drafted: false,
      queued: false,
    });
  });

  test("derives autoDraft, pilot and drafted per vacancy", async () => {
    const { table } = actionsTable([
      {
        data: [
          dbRow({ id: 4, vacancy_id: 10, action: "pilot" }),
          dbRow({ id: 3, vacancy_id: 10, action: "automated_draft_done" }),
          dbRow({ id: 2, vacancy_id: 10, action: "automated_draft" }),
          dbRow({ id: 1, vacancy_id: 20, action: "automated_draft_cleared" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.get(10)).toMatchObject({ autoDraft: true, pilot: true, drafted: true });
    expect(flags.get(20)).toMatchObject({ autoDraft: false, pilot: false, drafted: false, queued: false });
  });

  test("a truncated older row can't change the result — pagination collects every row, not just the first seen", async () => {
    const { table } = actionsTable([
      {
        data: [
          dbRow({ id: 5, vacancy_id: 10, action: "ignored", ignore_reason: "language", created_at: "2026-10-05T00:00:00.000Z" }),
          dbRow({ id: 2, vacancy_id: 10, action: "applied", applied_on: "2026-10-02" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.get(10)).toEqual({
      status: { status: "ignored", reason: "language", date: "2026-10-05" },
      starred: false,
      autoDraft: false,
      pilot: false,
      drafted: false,
      queued: false,
    });
    expect(flags.size).toBe(1);
  });

  test("keeps paging past a full page so no vacancy's flags go missing — fails without pagination", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) =>
      dbRow({ id: SUPABASE_MAX_ROWS - i, vacancy_id: SUPABASE_MAX_ROWS - i, applied_on: "2026-10-01" })
    );
    const secondPage = [
      dbRow({
        id: 1,
        vacancy_id: SUPABASE_MAX_ROWS + 1,
        action: "ignored",
        ignore_reason: "other",
        applied_on: null,
        created_at: "2026-09-01T00:00:00.000Z",
      }),
    ];
    const { table, limitMock, ltMock } = actionsTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const flags = await getVacancyFlags();

    expect(flags.size).toBe(SUPABASE_MAX_ROWS + 1);
    expect(flags.get(SUPABASE_MAX_ROWS + 1)).toEqual({
      status: { status: "ignored", reason: "other", date: "2026-09-01" },
      starred: false,
      autoDraft: false,
      pilot: false,
      drafted: false,
      queued: false,
    });
    expect(limitMock).toHaveBeenCalledTimes(3);
    expect(ltMock).toHaveBeenCalledTimes(2);
  });

  test("pages by a cursor on the last row's id, not a numeric offset — so a row inserted between page requests can't be skipped or double-counted", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) =>
      dbRow({ id: SUPABASE_MAX_ROWS - i, vacancy_id: SUPABASE_MAX_ROWS - i, applied_on: "2026-10-01" })
    );
    const { table, ltMock } = actionsTable([
      { data: fullPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    await getVacancyFlags();

    const lastRowOfPage1 = fullPage[fullPage.length - 1];
    expect(ltMock).toHaveBeenCalledWith("id", lastRowOfPage1.id);
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = actionsTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancyFlags()).rejects.toThrow("connection refused");
  });
});
