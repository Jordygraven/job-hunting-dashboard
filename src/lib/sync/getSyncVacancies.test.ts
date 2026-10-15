import { describe, expect, test, vi } from "vitest";
import { GREENHOUSE_BOARDS } from "@/config/greenhouseBoards";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => ({}) }));

import { LIST_NOT_AVAILABLE, getSyncVacancies, toSourceGroups } from "./getSyncVacancies";
import type { SourceResult, SyncRunRecord } from "./syncRunRecord";

const entry = (over: Partial<SourceResult>): SourceResult => ({
  source: "linkedin", found: 0, inserted: 0, skipped: 0, failed: 0, ...over,
});
const run = (over: Partial<SyncRunRecord>) =>
  ({ id: 1, runId: "r1", sourceResults: [], ...over }) as SyncRunRecord;
const line = { title: "T", company: "C", url: "u" };

const BOARDS = [
  { id: 1, portal: "greenhouse", identifier: "bybit", display_name: "Bybit" },
  { id: 2, portal: "greenhouse", identifier: "acme-gh", display_name: "Acme" },
  { id: 3, portal: "lever", identifier: "acme-lv", display_name: "Acme" },
];

// Boards read: one page, then empty (fetchAllRows stops on an empty page).
function boardsBuilder(boardEq: [string, string][], error: unknown, pages: { n: number }) {
  let portal = "";
  const b: any = {
    select: () => b,
    eq: (col: string, val: string) => (boardEq.push([col, val]), (portal = val), b),
    order: () => b,
    limit: () => b,
    gt: () => b,
    then: (resolve: any, reject: any) =>
      Promise.resolve(
        error
          ? { data: null, error }
          : { data: pages.n++ === 0 ? BOARDS.filter((r) => r.portal === portal) : [], error: null }
      ).then(resolve, reject),
  };
  return b;
}

function fakeClient(boardsError: unknown = null) {
  const calls: { cols: string; eq: [string, string][]; order?: unknown; limit?: number }[] = [];
  const boardEq: [string, string][] = [];
  const pages = { n: 0 };
  const client = {
    from: (table: string) => {
      if (table === "boards") return boardsBuilder(boardEq, boardsError, pages);
      expect(table).toBe("vacancies");
      const call: (typeof calls)[number] = { cols: "", eq: [] };
      calls.push(call);
      const q: any = {
        select: (cols: string) => ((call.cols = cols), q),
        eq: (col: string, val: string) => (call.eq.push([col, val]), q),
        order: (...args: unknown[]) => ((call.order = args), q),
        limit: (n: number) => ((call.limit = n), Promise.resolve({ data: [line], error: null })),
      };
      return q;
    },
  };
  return { client: client as any, calls, boardEq };
}

describe("getSyncVacancies", () => {
  test("3 entries: 2 queries, unknown board is not queried", async () => {
    const { client, calls } = fakeClient();
    const r = run({
      sourceResults: [
        entry({ source: "linkedin", inserted: 1 }),
        entry({ source: "greenhouse", board: "bybit", inserted: 1 }),
        entry({ source: "greenhouse", board: "gone", inserted: 7 }),
      ],
    });
    const groups = (await getSyncVacancies([r], client)).get(1) as any[];
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      cols: "title, company, url",
      eq: [["sync_run_id", "r1"], ["source", "linkedin"]],
      order: ["id", { ascending: true }],
      limit: 100,
    });
    expect(calls[1].eq).toContainEqual(["company", "Bybit"]);
    expect(groups[2]).toMatchObject({ label: "gone", inserted: 7, lines: null, more: 7 });
  });
  test("two portals share display name Acme: lookup and query use greenhouse only", async () => {
    const { client, calls, boardEq } = fakeClient();
    const r = run({
      sourceResults: [
        entry({ source: "greenhouse", board: "acme-gh", inserted: 1 }),
        entry({ source: "greenhouse", board: "acme-lv", inserted: 1 }),
      ],
    });
    const groups = (await getSyncVacancies([r], client)).get(1) as any[];
    expect(boardEq.length).toBeGreaterThan(0);
    expect(boardEq.every(([c, v]) => c === "portal" && v === "greenhouse")).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].eq).toEqual([["sync_run_id", "r1"], ["source", "greenhouse"], ["company", "Acme"]]);
    expect(groups[0]).toMatchObject({ label: "Acme", lines: [line] });
    expect(groups[1]).toMatchObject({ label: "acme-lv", lines: null });
  });
  test("failed boards read throws", async () => {
    const { client } = fakeClient({ message: "boom" });
    await expect(getSyncVacancies([run({ sourceResults: [entry({})] })], client)).rejects.toThrow();
  });
  test("inserted 0: no query, empty list", async () => {
    const { client, calls } = fakeClient();
    const r = run({ sourceResults: [entry({ source: "greenhouse", board: "bybit", inserted: 0 })] });
    const groups = (await getSyncVacancies([r], client)).get(1) as any[];
    expect(calls).toHaveLength(0);
    expect(groups[0]).toMatchObject({ label: "Bybit", inserted: 0, lines: [], more: 0 });
  });
  test("inserted above 0 queries once with the same filters", async () => {
    const { client, calls } = fakeClient();
    await getSyncVacancies([run({ sourceResults: [entry({ inserted: 1 })] })], client);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      cols: "title, company, url",
      eq: [["sync_run_id", "r1"], ["source", "linkedin"]],
      order: ["id", { ascending: true }],
      limit: 100,
    });
  });
  test("LinkedIn 8 + Greenhouse board 0: exactly 1 query", async () => {
    const { client, calls } = fakeClient();
    const r = run({
      sourceResults: [
        entry({ source: "linkedin", inserted: 8 }),
        entry({ source: "greenhouse", board: "bybit", inserted: 0 }),
      ],
    });
    await getSyncVacancies([r], client);
    expect(calls).toHaveLength(1);
  });
  test("null runId or null source_results: no query", async () => {
    const { client, calls } = fakeClient();
    const result = await getSyncVacancies(
      [run({ id: 1, runId: null, sourceResults: [entry({})] }), run({ id: 2, sourceResults: null })],
      client
    );
    expect(calls).toHaveLength(0);
    expect([...result.values()]).toEqual([LIST_NOT_AVAILABLE, LIST_NOT_AVAILABLE]);
  });
});

describe("toSourceGroups", () => {
  const lines = (n: number) => Array.from({ length: n }, () => line);
  test("more = inserted - shown, never below 0", () => {
    const r = run({ sourceResults: [entry({ inserted: 130 }), entry({ inserted: 40 }), entry({ inserted: 2 })] });
    const g = toSourceGroups(r, [lines(100), lines(40), lines(3)], new Map()) as any[];
    expect(g.map((x) => x.more)).toEqual([30, 0, 0]);
  });
  test("known board shows display name", () => {
    const r = run({ sourceResults: [entry({ source: "greenhouse", board: "bybit" })] });
    expect((toSourceGroups(r, [[]], new Map([["bybit", "Bybit"]])) as any[])[0].label).toBe("Bybit");
  });
  test("marker when list not available", () => {
    expect(toSourceGroups(run({ runId: null }), [], new Map())).toBe(LIST_NOT_AVAILABLE);
    expect(toSourceGroups(run({ sourceResults: null }), [], new Map())).toBe(LIST_NOT_AVAILABLE);
  });
});

describe("greenhouseBoards config", () => {
  test("display names are unique", () => {
    const names = GREENHOUSE_BOARDS.map((b) => b.displayName);
    expect(new Set(names).size).toBe(names.length);
  });
});
