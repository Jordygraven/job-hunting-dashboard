import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getLatestChecks } from "./getLatestChecks";

function fakeClient(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const ltMock = vi.fn();
  const b: any = {
    select: () => b,
    order: () => b,
    limit: () => b,
    lt: (...args: any[]) => { ltMock(...args); return b; },
    then: (resolve: any, reject: any) =>
      Promise.resolve(pages[Math.min(call++, pages.length - 1)]).then(resolve, reject),
  };
  return { client: { from: () => b } as any, ltMock };
}

const row = (id: number, board_id: number, status: string, job_count: number | null) => ({
  id, board_id, status, job_count, checked_at: `2026-10-${String(id).padStart(2, "0")}T00:00:00.000Z`,
});

describe("getLatestChecks", () => {
  test("keeps the newest row per board", async () => {
    const { client, ltMock } = fakeClient([
      { data: [row(5, 1, "dead", null), row(4, 2, "empty", 0), row(3, 1, "active", 7)], error: null },
      { data: [], error: null },
    ]);
    const latest = await getLatestChecks(client);
    expect(latest.size).toBe(2);
    expect(latest.get(1)).toEqual({ boardId: 1, status: "dead", jobCount: null, checkedAt: "2026-10-05T00:00:00.000Z" });
    expect(latest.get(2)?.status).toBe("empty");
    expect(ltMock).toHaveBeenCalledWith("id", 3);
  });

  test("empty table gives an empty map", async () => {
    const { client } = fakeClient([{ data: [], error: null }]);
    expect((await getLatestChecks(client)).size).toBe(0);
  });
});
