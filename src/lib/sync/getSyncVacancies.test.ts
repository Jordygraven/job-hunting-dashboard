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

function fakeClient() {
  const calls: { cols: string; eq: [string, string][]; order?: unknown; limit?: number }[] = [];
  const client = {
    from: (table: string) => {
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
  return { client: client as any, calls };
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
    const g = toSourceGroups(r, [lines(100), lines(40), lines(3)]) as any[];
    expect(g.map((x) => x.more)).toEqual([30, 0, 0]);
  });
  test("known board shows display name", () => {
    const r = run({ sourceResults: [entry({ source: "greenhouse", board: "bybit" })] });
    expect((toSourceGroups(r, [[]]) as any[])[0].label).toBe("Bybit");
  });
  test("marker when list not available", () => {
    expect(toSourceGroups(run({ runId: null }), [])).toBe(LIST_NOT_AVAILABLE);
    expect(toSourceGroups(run({ sourceResults: null }), [])).toBe(LIST_NOT_AVAILABLE);
  });
});

describe("greenhouseBoards config", () => {
  test("display names are unique", () => {
    const names = GREENHOUSE_BOARDS.map((b) => b.displayName);
    expect(new Set(names).size).toBe(names.length);
  });
});
