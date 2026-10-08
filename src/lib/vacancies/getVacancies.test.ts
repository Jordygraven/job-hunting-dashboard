import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancies } from "./getVacancies";
import { SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";

function vacanciesTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const orMock = vi.fn();
  function builder(): any {
    const b: any = { or: (...args: any[]) => { orMock(...args); return b; } };
    b.then = (resolve: any, reject: any) =>
      Promise.resolve(pages[Math.min(call++, pages.length - 1)]).then(resolve, reject);
    return b;
  }
  const limitMock = vi.fn(() => builder());
  const orderMock2 = vi.fn(() => ({ limit: limitMock }));
  const orderMock1 = vi.fn(() => ({ order: orderMock2 }));
  return { table: { select: () => ({ order: orderMock1 }) }, limitMock, orderMock1, orderMock2, orMock };
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
      { data: [], error: null },
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
    const { table, limitMock, orMock } = vacanciesTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    const vacancies = await getVacancies();

    expect(vacancies).toHaveLength(SUPABASE_MAX_ROWS + 1);
    expect(limitMock).toHaveBeenCalledTimes(3);
    expect(orMock).toHaveBeenCalledTimes(2);
  });

  test("pages by a cursor on the last row, not a numeric offset — so a row inserted between page requests can't be skipped or double-counted", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: SUPABASE_MAX_ROWS - i,
      title: `Job ${SUPABASE_MAX_ROWS - i}`,
      company: "Acme",
      location: "Remote",
      url: `https://x/${SUPABASE_MAX_ROWS - i}`,
      first_seen_at: "2026-10-01T00:00:00.000Z",
    }));
    const { table, orMock } = vacanciesTable([
      { data: fullPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    await getVacancies();

    const lastRowOfPage1 = fullPage[fullPage.length - 1];
    expect(orMock).toHaveBeenCalledWith(
      `first_seen_at.lt."${lastRowOfPage1.first_seen_at}",and(first_seen_at.eq."${lastRowOfPage1.first_seen_at}",id.lt.${lastRowOfPage1.id})`
    );
  });

  test("quotes a cursor timestamp containing + and : so PostgREST doesn't misparse it", async () => {
    const timestampWithOffset = "2026-10-01T09:00:00.000+08:00";
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: SUPABASE_MAX_ROWS - i,
      title: `Job ${SUPABASE_MAX_ROWS - i}`,
      company: "Acme",
      location: "Remote",
      url: `https://x/${SUPABASE_MAX_ROWS - i}`,
      first_seen_at: timestampWithOffset,
    }));
    const { table, orMock } = vacanciesTable([
      { data: fullPage, error: null },
      { data: [], error: null },
    ]);
    fromMock.mockReturnValue(table);

    await getVacancies();

    const lastRowOfPage1 = fullPage[fullPage.length - 1];
    expect(orMock).toHaveBeenCalledWith(
      `first_seen_at.lt."${timestampWithOffset}",and(first_seen_at.eq."${timestampWithOffset}",id.lt.${lastRowOfPage1.id})`
    );
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = vacanciesTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancies()).rejects.toThrow("connection refused");
  });
});
