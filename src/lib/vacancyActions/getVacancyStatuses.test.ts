import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancyStatuses } from "./getVacancyStatuses";

function actionsTable(result: { data: unknown; error: unknown }) {
  const orderMock = vi.fn(() => Promise.resolve(result));
  return { table: { select: () => ({ order: orderMock }) }, orderMock };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancyStatuses", () => {
  test("returns an empty map when there are no action rows", async () => {
    const { table, orderMock } = actionsTable({ data: [], error: null });
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(0);
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("groups rows by vacancy_id and derives each vacancy's status independently", async () => {
    const { table, orderMock } = actionsTable({
      data: [
        { id: 3, vacancy_id: 10, action: "reset", ignore_reason: null, applied_on: null, created_at: "2026-10-03T00:00:00.000Z" },
        { id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-02T00:00:00.000Z" },
        { id: 1, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" },
      ],
      error: null,
    });
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "todo" });
    expect(statuses.get(20)).toEqual({ status: "ignored", reason: "language", date: "2026-10-02" });
    expect(statuses.size).toBe(2);
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("uses only the first-seen (highest id) row per vacancy, so a truncated older row can't change the result", async () => {
    const { table } = actionsTable({
      data: [
        { id: 5, vacancy_id: 10, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-05T00:00:00.000Z" },
        { id: 2, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-02", created_at: "2026-10-02T00:00:00.000Z" },
      ],
      error: null,
    });
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    // The id 5 row (ignored) is seen first in descending order and wins; the
    // id 2 row (applied) is the vacancy's older row and must be ignored even
    // though it would produce a different status if it were used instead.
    expect(statuses.get(10)).toEqual({ status: "ignored", reason: "language", date: "2026-10-05" });
    expect(statuses.size).toBe(1);
  });

  test("throws a plain Error with the DB message when the query fails", async () => {
    const { table } = actionsTable({ data: null, error: { message: "connection refused" } });
    fromMock.mockReturnValue(table);

    await expect(getVacancyStatuses()).rejects.toThrow("connection refused");
  });
});
