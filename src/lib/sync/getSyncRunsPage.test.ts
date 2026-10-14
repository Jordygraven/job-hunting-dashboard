import { beforeEach, describe, expect, test, vi } from "vitest";

let countResult: any;
let rangeMock: any;
const orderMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      select: (_cols: string, opts?: { head?: boolean }) =>
        opts?.head ? Promise.resolve(countResult) : { order: orderMock },
    }),
  }),
}));

import { getSyncRunsPage } from "./getSyncRunsPage";

beforeEach(() => {
  countResult = { count: 12, error: null };
  rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
  orderMock.mockReturnValue({ range: rangeMock });
});

describe("getSyncRunsPage", () => {
  test("12 runs make 3 pages of 5, newest first", async () => {
    const result = await getSyncRunsPage("2");
    expect(result).toMatchObject({ page: 2, totalPages: 3 });
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
    expect(rangeMock).toHaveBeenCalledWith(5, 9);
  });
  test("out-of-range page clamps to the last page", async () => {
    expect((await getSyncRunsPage("99")).page).toBe(3);
    expect(rangeMock).toHaveBeenCalledWith(10, 14);
  });
  test("no runs gives page 1 of 1", async () => {
    countResult = { count: 0, error: null };
    expect(await getSyncRunsPage(undefined)).toMatchObject({ runs: [], page: 1, totalPages: 1 });
  });
  test("throws on count error", async () => {
    countResult = { count: null, error: { message: "boom" } };
    await expect(getSyncRunsPage("1")).rejects.toThrow("boom");
  });
});
