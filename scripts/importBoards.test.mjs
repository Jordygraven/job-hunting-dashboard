import { describe, expect, test } from "vitest";
import { parseCsv, selectBoards, toSql } from "./importBoards.mjs";

const HEADER = "company,source,portal,slug,board_name,match_check,total_jobs,matching_jobs\n";
const run = (body) => selectBoards(parseCsv(HEADER + body));

describe("parseCsv", () => {
  test("keeps a quoted comma in board_name", () => {
    const [r] = parseCsv(HEADER + 'Acme,s,greenhouse,acme,"Acme, Inc.",ok,3,1\n');
    expect(r.board_name).toBe("Acme, Inc.");
    expect(r.total_jobs).toBe("3");
  });
});

describe("selectBoards", () => {
  test("drops total_jobs 0", () => {
    expect(run("A,s,greenhouse,a,,ok,0,0\n").kept).toEqual([]);
  });
  test("drops match_check check", () => {
    expect(run("A,s,greenhouse,a,,check,5,0\n").dropped.notOk).toBe(1);
  });
  test("drops the three named companies, any case", () => {
    const { kept } = run(
      "Remote.com,s,greenhouse,remote,,ok,5,1\nwiz.ai,s,greenhouse,wiz,,ok,5,1\nGATE.IO,s,greenhouse,gate,,ok,5,1\n",
    );
    expect(kept).toEqual([]);
  });
  test("keeps a duplicate slug once", () => {
    const { kept } = run("A,s,greenhouse,a,,ok,5,1\nA,t,greenhouse,a,,ok,5,1\n");
    expect(kept).toEqual([{ portal: "greenhouse", identifier: "a", displayName: "A", jobCount: 5 }]);
  });
  test("drops other portals", () => {
    expect(run("A,s,lever,a,,ok,5,1\n").kept).toEqual([]);
  });
});

describe("toSql", () => {
  test("doubles apostrophes and ends with the count", () => {
    const sql = toSql([{ portal: "greenhouse", identifier: "oreilly", displayName: "O'Reilly", jobCount: 4 }]);
    expect(sql).toContain("'O''Reilly'");
    expect(sql).toContain("select id, 'active', 4 from b;");
    expect(sql.trimEnd().endsWith("select count(*) from public.boards;")).toBe(true);
  });
});
