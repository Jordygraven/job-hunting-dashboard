import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancyStatuses } from "./getVacancyStatuses";
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

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancyStatuses", () => {
  test("returns an empty map when there are no action rows", async () => {
    const { table } = actionsTable([{ data: [], error: null }]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(0);
  });

  test("groups rows by vacancy_id and derives each vacancy's status independently", async () => {
    const { table, orderMock } = actionsTable([
      {
        data: [
          { id: 3, vacancy_id: 10, action: "reset", ignore_reason: null, applied_on: null, created_at: "2026-10-03T00:00:00.000Z" },
          { id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-02T00:00:00.000Z" },
          { id: 1, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "todo" });
    expect(statuses.get(20)).toEqual({ status: "ignored", reason: "language", date: "2026-10-02" });
    expect(statuses.size).toBe(2);
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("uses only the first-seen (highest id) row per vacancy, so a truncated older row can't change the result", async () => {
    const { table } = actionsTable([
      {
        data: [
          { id: 5, vacancy_id: 10, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-05T00:00:00.000Z" },
          { id: 2, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-02", created_at: "2026-10-02T00:00:00.000Z" },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "ignored", reason: "language", date: "2026-10-05" });
    expect(statuses.size).toBe(1);
  });

  test("keeps paging past a full page so no vacancy's status goes missing — fails without pagination", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: SUPABASE_MAX_ROWS - i,
      vacancy_id: SUPABASE_MAX_ROWS - i,
      action: "applied",
      ignore_reason: null,
      applied_on: "2026-10-01",
      created_at: "2026-10-01T00:00:00.000Z",
    }));
    const secondPage = [
      {
        id: 1,
        vacancy_id: SUPABASE_MAX_ROWS + 1,
        action: "ignored",
        ignore_reason: "other",
        applied_on: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const { table, limitMock, ltMock } = actionsTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(SUPABASE_MAX_ROWS + 1);
    expect(statuses.get(SUPABASE_MAX_ROWS + 1)).toEqual({ status: "ignored", reason: "other", date: "2026-09-01" });
    expect(limitMock).toHaveBeenCalledTimes(3);
    expect(ltMock).toHaveBeenCalledTimes(2);
  });

  test("pages by a cursor on the last row's id, not a numeric offset — so a row inserted between page requests can't be skipped or double-counted", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: SUPABASE_MAX_ROWS - i,
      vacancy_id: SUPABASE_MAX_ROWS - i,
      action: "applied",
      ignore_reason: null,
      applied_on: "2026-10-01",
      created_at: "2026-10-01T00:00:00.000Z",
    }));
    const { table, ltMock } = actionsTable([
      { data: fullPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    await getVacancyStatuses();

    const lastRowOfPage1 = fullPage[fullPage.length - 1];
    expect(ltMock).toHaveBeenCalledWith("id", lastRowOfPage1.id);
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = actionsTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancyStatuses()).rejects.toThrow("connection refused");
  });
});
