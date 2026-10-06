import { describe, expect, test, vi } from "vitest";
import { fetchAllRows, SUPABASE_MAX_ROWS } from "./fetchAllRows";

function page(n: number, startId: number) {
  return Array.from({ length: n }, (_, i) => ({ id: startId + i }));
}

describe("fetchAllRows", () => {
  test("returns everything from a single page under the cap, in one request", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: page(3, 1), error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, SUPABASE_MAX_ROWS - 1);
  });

  test("keeps paging past a full (capped) page until a short page ends it — fails without pagination", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page(SUPABASE_MAX_ROWS, 1), error: null })
      .mockResolvedValueOnce({ data: page(2, SUPABASE_MAX_ROWS + 1), error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(SUPABASE_MAX_ROWS + 2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1);
  });

  test("stops immediately on an empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [], error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test("throws a plain Error with the DB message when a page errors", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: { message: "connection refused" } });
    await expect(fetchAllRows(fetchPage)).rejects.toThrow("connection refused");
  });
});
