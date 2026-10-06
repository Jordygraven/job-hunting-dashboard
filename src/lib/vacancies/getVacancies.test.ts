import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancies } from "./getVacancies";
import { SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";

function vacanciesTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const rangeMock = vi.fn(() => Promise.resolve(pages[Math.min(call++, pages.length - 1)]));
  const orderMock2 = vi.fn(() => ({ range: rangeMock }));
  const orderMock1 = vi.fn(() => ({ order: orderMock2 }));
  return { table: { select: () => ({ order: orderMock1 }) }, rangeMock, orderMock1, orderMock2 };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancies", () => {
  test("maps snake_case rows to camelCase, passing a null location through as-is", async () => {
    const { table } = vacanciesTable([
      {
        data: [
          { id: 1, title: "Engineer", company: "Acme", location: null, url: "https://x/1", first_seen_at: "2026-10-01T00:00:00.000Z" },
        ],
        error: null,
      },
    ]);
    fromMock.mockReturnValue(table);

    const vacancies = await getVacancies();

    expect(vacancies).toEqual([
      { id: 1, title: "Engineer", company: "Acme", location: null, url: "https://x/1", firstSeenAt: "2026-10-01T00:00:00.000Z" },
    ]);
  });

  test("orders by first_seen_at descending, then id descending as a tiebreaker", async () => {
    const { table, orderMock1, orderMock2 } = vacanciesTable([{ data: [], error: null }]);
    fromMock.mockReturnValue(table);

    await getVacancies();

    expect(orderMock1).toHaveBeenCalledWith("first_seen_at", { ascending: false });
    expect(orderMock2).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("keeps paging past a full page so counts never silently undercount — fails without pagination", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: i + 1,
      title: `Job ${i + 1}`,
      company: "Acme",
      location: "Remote",
      url: `https://x/${i + 1}`,
      first_seen_at: "2026-10-01T00:00:00.000Z",
    }));
    const secondPage = [
      { id: SUPABASE_MAX_ROWS + 1, title: "Last job", company: "Acme", location: "Remote", url: "https://x/last", first_seen_at: "2026-09-30T00:00:00.000Z" },
    ];
    const { table, rangeMock } = vacanciesTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
    ]);
    fromMock.mockReturnValue(table);

    const vacancies = await getVacancies();

    expect(vacancies).toHaveLength(SUPABASE_MAX_ROWS + 1);
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, SUPABASE_MAX_ROWS - 1);
    expect(rangeMock).toHaveBeenNthCalledWith(2, SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1);
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = vacanciesTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancies()).rejects.toThrow("connection refused");
  });
});
