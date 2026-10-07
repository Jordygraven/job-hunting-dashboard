import { describe, expect, test, vi } from "vitest";
import { fetchAllRows } from "./fetchAllRows";

function page(n: number, startId: number) {
  return Array.from({ length: n }, (_, i) => ({ id: startId + i }));
}

describe("fetchAllRows", () => {
  test("returns everything from a single page, in one request", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page(3, 1), error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
  });

  test("keeps paging until an empty page ends it, anchoring each call to the previous page's last row", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page(3, 1), error: null })
      .mockResolvedValueOnce({ data: page(2, 4), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(5);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, { id: 3 });
    expect(fetchPage).toHaveBeenNthCalledWith(3, { id: 5 });
  });

  test("stops immediately on an empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [], error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test("keeps paging even when the real cap is lower than the requested page size", async () => {
    const allRows = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));
    const REAL_CAP = 3;
    const fetchPage = vi.fn((after: { id: number } | null) => {
      const startIndex = after ? allRows.findIndex((r) => r.id === after.id) + 1 : 0;
      const data = allRows.slice(startIndex, startIndex + REAL_CAP);
      return Promise.resolve({ data, error: null });
    });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toEqual(allRows);
    expect(fetchPage).toHaveBeenCalledTimes(4);
  });

  test("throws a plain Error with the DB message when a page errors", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: { message: "connection refused" } });
    await expect(fetchAllRows(fetchPage)).rejects.toThrow("connection refused");
  });

  test("throws after exceeding the page-count guard, never returning a partial list", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
    await expect(fetchAllRows(fetchPage, 5)).rejects.toThrow(/5 pages/);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });
});
