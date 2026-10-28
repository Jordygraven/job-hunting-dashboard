import { describe, expect, test } from "vitest";
import {
  COLUMNS_BY_VIEW,
  nextSortState,
  resolveSort,
  sortRows,
  type SortableColumnKey,
} from "./vacancySort";
import type { VacancyTabRow } from "./vacancyTabs";

function row(overrides: Partial<VacancyTabRow> = {}): VacancyTabRow {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "KL",
    url: "https://x/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    status: "todo",
    appliedOn: null,
    outcomeOn: null,
    ignoredOn: null,
    ignoreReason: null,
    starred: false,
    autoDraft: false,
    pilot: false,
    drafted: false,
    queued: false,
    ...overrides,
  };
}

describe("COLUMNS_BY_VIEW", () => {
  test("lists the sortable columns per tab per spec", () => {
    expect(COLUMNS_BY_VIEW.todo).toEqual(["title", "company", "location", "firstSeenAt"]);
    expect(COLUMNS_BY_VIEW.interest).toEqual(["title", "company", "location", "firstSeenAt", "status"]);
    expect(COLUMNS_BY_VIEW.applied).toEqual([
      "title",
      "company",
      "location",
      "firstSeenAt",
      "appliedOn",
    ]);
    expect(COLUMNS_BY_VIEW.success).toEqual([
      "title",
      "company",
      "location",
      "firstSeenAt",
      "appliedOn",
      "outcomeOn",
    ]);
    expect(COLUMNS_BY_VIEW.rejected).toEqual([
      "title",
      "company",
      "location",
      "firstSeenAt",
      "appliedOn",
      "outcomeOn",
    ]);
    expect(COLUMNS_BY_VIEW.ignored).toEqual([
      "title",
      "company",
      "location",
      "firstSeenAt",
      "ignoredOn",
      "ignoreReason",
    ]);
    expect(COLUMNS_BY_VIEW.all).toEqual(["title", "company", "location", "firstSeenAt", "status"]);
    expect(COLUMNS_BY_VIEW.autodraft).toEqual(["title", "company", "location", "firstSeenAt", "status"]);
  });

  test("outcomeOn is not sortable on all (or anywhere outside Success/Rejected)", () => {
    expect(COLUMNS_BY_VIEW.all).not.toContain("outcomeOn");
    expect(COLUMNS_BY_VIEW.todo).not.toContain("outcomeOn");
    expect(COLUMNS_BY_VIEW.applied).not.toContain("outcomeOn");
    expect(COLUMNS_BY_VIEW.interest).not.toContain("outcomeOn");
  });
});

describe("nextSortState", () => {
  test("cycles none to asc to desc to none on the same column", () => {
    expect(nextSortState("title", null, null)).toEqual({ sort: "title", dir: "asc" });
    expect(nextSortState("title", "title", "asc")).toEqual({ sort: "title", dir: "desc" });
    expect(nextSortState("title", "title", "desc")).toEqual({ sort: null, dir: null });
  });

  test("switching to a different column resets to asc", () => {
    expect(nextSortState("company", "title", "desc")).toEqual({ sort: "company", dir: "asc" });
  });
});

describe("resolveSort", () => {
  test("accepts a valid column and dir for the view", () => {
    expect(resolveSort("todo", "title", "asc")).toEqual({ sort: "title", dir: "asc" });
    expect(resolveSort("all", "status", "desc")).toEqual({ sort: "status", dir: "desc" });
  });

  test("ignores an unknown column name", () => {
    expect(resolveSort("todo", "nope", "asc")).toEqual({ sort: null, dir: null });
  });

  test("ignores an invalid dir value", () => {
    expect(resolveSort("todo", "title", "sideways")).toEqual({ sort: null, dir: null });
  });

  test("ignores a column that isn't sortable on the given view", () => {
    expect(resolveSort("todo", "status", "asc")).toEqual({ sort: null, dir: null });
    expect(resolveSort("todo", "appliedOn", "asc")).toEqual({ sort: null, dir: null });
    expect(resolveSort("all", "outcomeOn", "asc")).toEqual({ sort: null, dir: null });
  });

  test("resolves to null when params are missing", () => {
    expect(resolveSort("todo", undefined, undefined)).toEqual({ sort: null, dir: null });
  });

  test("takes the first value when given as an array (repeated param)", () => {
    expect(resolveSort("todo", ["title", "company"], ["asc", "desc"])).toEqual({
      sort: "title",
      dir: "asc",
    });
  });
});

describe("sortRows", () => {
  test("with no sort/dir, starred rows float to the top; relative order preserved within each group", () => {
    const rows = [
      row({ id: 1, title: "A", starred: false }),
      row({ id: 2, title: "B", starred: true }),
      row({ id: 3, title: "C", starred: false }),
      row({ id: 4, title: "D", starred: true }),
    ];
    expect(sortRows(rows, null, null).map((r) => r.id)).toEqual([2, 4, 1, 3]);
    expect(sortRows(rows, "title", null).map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  test("with no starred rows at all, default order is unchanged", () => {
    const rows = [row({ id: 3, title: "C" }), row({ id: 1, title: "A" }), row({ id: 2, title: "B" })];
    expect(sortRows(rows, null, null).map((r) => r.id)).toEqual([3, 1, 2]);
  });

  test("an explicit column sort ignores starred entirely — header click always wins", () => {
    const rows = [
      row({ id: 1, title: "banana", starred: false }),
      row({ id: 2, title: "apple", starred: true }),
    ];
    expect(sortRows(rows, "title", "asc").map((r) => r.id)).toEqual([2, 1]);
  });

  test("title: sorts asc and desc, case-insensitively, tie broken by id", () => {
    const rows = [
      row({ id: 2, title: "banana" }),
      row({ id: 1, title: "Apple" }),
      row({ id: 3, title: "apple" }),
    ];
    expect(sortRows(rows, "title", "asc").map((r) => r.id)).toEqual([1, 3, 2]);
    expect(sortRows(rows, "title", "desc").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  test("company: sorts asc and desc", () => {
    const rows = [row({ id: 1, company: "Zeta" }), row({ id: 2, company: "Alpha" })];
    expect(sortRows(rows, "company", "asc").map((r) => r.id)).toEqual([2, 1]);
    expect(sortRows(rows, "company", "desc").map((r) => r.id)).toEqual([1, 2]);
  });

  test("location: a null or empty location sorts last in both asc and desc", () => {
    const rows = [
      row({ id: 1, location: "Penang" }),
      row({ id: 2, location: null }),
      row({ id: 3, location: "Johor" }),
      row({ id: 4, location: "" }),
    ];
    expect(sortRows(rows, "location", "asc").map((r) => r.id)).toEqual([3, 1, 2, 4]);
    expect(sortRows(rows, "location", "desc").map((r) => r.id)).toEqual([1, 3, 2, 4]);
  });

  test("firstSeenAt: asc is oldest first", () => {
    const rows = [
      row({ id: 1, firstSeenAt: "2026-10-05T00:00:00.000Z" }),
      row({ id: 2, firstSeenAt: "2026-10-01T00:00:00.000Z" }),
    ];
    expect(sortRows(rows, "firstSeenAt", "asc").map((r) => r.id)).toEqual([2, 1]);
    expect(sortRows(rows, "firstSeenAt", "desc").map((r) => r.id)).toEqual([1, 2]);
  });

  test("appliedOn: asc is oldest first, empty sorts last in both directions", () => {
    const rows = [
      row({ id: 1, appliedOn: "2026-10-05" }),
      row({ id: 2, appliedOn: null }),
      row({ id: 3, appliedOn: "2026-10-01" }),
    ];
    expect(sortRows(rows, "appliedOn", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRows(rows, "appliedOn", "desc").map((r) => r.id)).toEqual([1, 3, 2]);
  });

  test("outcomeOn: asc is oldest first, empty sorts last in both directions", () => {
    const rows = [
      row({ id: 1, outcomeOn: "2026-10-05" }),
      row({ id: 2, outcomeOn: null }),
      row({ id: 3, outcomeOn: "2026-10-01" }),
    ];
    expect(sortRows(rows, "outcomeOn", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRows(rows, "outcomeOn", "desc").map((r) => r.id)).toEqual([1, 3, 2]);
  });

  test("ignoredOn: asc is oldest first", () => {
    const rows = [
      row({ id: 1, ignoredOn: "2026-10-05" }),
      row({ id: 2, ignoredOn: "2026-10-01" }),
    ];
    expect(sortRows(rows, "ignoredOn", "asc").map((r) => r.id)).toEqual([2, 1]);
    expect(sortRows(rows, "ignoredOn", "desc").map((r) => r.id)).toEqual([1, 2]);
  });

  test("ignoreReason: sorts by the shown label, null sorts last in both directions", () => {
    const rows = [
      row({ id: 1, ignoreReason: "seniority" }), // "Seniority"
      row({ id: 2, ignoreReason: null }),
      row({ id: 3, ignoreReason: "interest" }), // "Interest"
    ];
    expect(sortRows(rows, "ignoreReason", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortRows(rows, "ignoreReason", "desc").map((r) => r.id)).toEqual([1, 3, 2]);
  });

  test("status: sorts by the shown label, case-insensitively", () => {
    const rows = [
      row({ id: 1, status: "todo" }), // "To do"
      row({ id: 2, status: "applied" }), // "Applied"
      row({ id: 3, status: "ignored" }), // "Ignored"
    ];
    expect(sortRows(rows, "status", "asc").map((r) => r.id)).toEqual([2, 3, 1]);
  });

  test("applies to the full row set, not just a slice (caller slices after sorting)", () => {
    const rows: VacancyTabRow[] = Array.from({ length: 15 }, (_, i) =>
      row({ id: i + 1, title: `Item ${String(15 - i).padStart(2, "0")}` })
    );
    const sorted = sortRows(rows, "title", "asc");
    expect(sorted).toHaveLength(15);
    expect(sorted[0].title).toBe("Item 01");
    expect(sorted[14].title).toBe("Item 15");
  });

  test("ties break by ascending id regardless of sort direction", () => {
    const rows = [row({ id: 2, title: "Same" }), row({ id: 1, title: "Same" })];
    expect(sortRows(rows, "title", "asc").map((r) => r.id)).toEqual([1, 2]);
    expect(sortRows(rows, "title", "desc").map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("column coverage", () => {
  test("every column referenced by COLUMNS_BY_VIEW has a working comparator", () => {
    const allColumns = new Set<SortableColumnKey>(Object.values(COLUMNS_BY_VIEW).flat());
    const sample = [row({ id: 1 }), row({ id: 2 })];
    for (const column of allColumns) {
      expect(() => sortRows(sample, column, "asc")).not.toThrow();
    }
  });
});
