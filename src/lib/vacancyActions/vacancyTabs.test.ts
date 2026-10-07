import { describe, expect, test } from "vitest";
import {
  buildVacancyTabRow,
  countByView,
  describeShownRows,
  resolveReasonFilter,
  resolveShow,
  resolveView,
  selectRowsForView,
  sliceRowsForShow,
  type VacancyTabRow,
} from "./vacancyTabs";
import type { Vacancy } from "@/lib/vacancies/getVacancies";
import type { VacancyStatus } from "./types";

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function tabRow(overrides: Partial<VacancyTabRow> = {}): VacancyTabRow {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    status: "todo",
    appliedOn: null,
    ignoredOn: null,
    ignoreReason: null,
    ...overrides,
  };
}

describe("resolveView", () => {
  test("defaults to todo when no param is given", () => {
    expect(resolveView(undefined)).toBe("todo");
  });

  test("accepts each known view", () => {
    expect(resolveView("todo")).toBe("todo");
    expect(resolveView("applied")).toBe("applied");
    expect(resolveView("ignored")).toBe("ignored");
    expect(resolveView("all")).toBe("all");
  });

  test("falls back to todo for an unknown value", () => {
    expect(resolveView("bogus")).toBe("todo");
  });

  test("takes the first element when given an array (and falls back if that's unknown)", () => {
    expect(resolveView(["applied", "all"])).toBe("applied");
    expect(resolveView(["bogus"])).toBe("todo");
  });
});

describe("resolveReasonFilter", () => {
  test("is always null outside the ignored tab, even with a valid-looking reason", () => {
    expect(resolveReasonFilter("todo", "language")).toBeNull();
    expect(resolveReasonFilter("applied", "none")).toBeNull();
    expect(resolveReasonFilter("all", "other")).toBeNull();
  });

  test("accepts each known reason and 'none' on the ignored tab", () => {
    expect(resolveReasonFilter("ignored", "language")).toBe("language");
    expect(resolveReasonFilter("ignored", "interest")).toBe("interest");
    expect(resolveReasonFilter("ignored", "seniority")).toBe("seniority");
    expect(resolveReasonFilter("ignored", "other")).toBe("other");
    expect(resolveReasonFilter("ignored", "none")).toBe("none");
  });

  test("is null when absent or unknown on the ignored tab (meaning: all reasons)", () => {
    expect(resolveReasonFilter("ignored", undefined)).toBeNull();
    expect(resolveReasonFilter("ignored", "bogus")).toBeNull();
  });
});

describe("buildVacancyTabRow", () => {
  test("todo status carries no date/reason", () => {
    const status: VacancyStatus = { status: "todo" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(tabRow({ status: "todo" }));
  });

  test("applied status carries appliedOn, no ignoredOn/reason", () => {
    const status: VacancyStatus = { status: "applied", appliedOn: "2026-10-02" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(
      tabRow({ status: "applied", appliedOn: "2026-10-02" })
    );
  });

  test("ignored status carries ignoredOn and reason (possibly null)", () => {
    const status: VacancyStatus = { status: "ignored", reason: "interest", date: "2026-10-03" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(
      tabRow({ status: "ignored", ignoredOn: "2026-10-03", ignoreReason: "interest" })
    );
  });
});

describe("selectRowsForView", () => {
  const rows = [
    tabRow({ id: 1, status: "todo" }),
    tabRow({ id: 2, status: "applied", appliedOn: "2026-10-01" }),
    tabRow({ id: 3, status: "ignored", ignoreReason: "language", ignoredOn: "2026-10-01" }),
    tabRow({ id: 4, status: "ignored", ignoreReason: null, ignoredOn: "2026-10-02" }),
  ];

  test("all returns every row, preserving order", () => {
    expect(selectRowsForView(rows, "all", null).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  test("todo/applied/ignored each return only their own status", () => {
    expect(selectRowsForView(rows, "todo", null).map((r) => r.id)).toEqual([1]);
    expect(selectRowsForView(rows, "applied", null).map((r) => r.id)).toEqual([2]);
    expect(selectRowsForView(rows, "ignored", null).map((r) => r.id)).toEqual([3, 4]);
  });

  test("a reason filter on the ignored tab narrows further", () => {
    expect(selectRowsForView(rows, "ignored", "language").map((r) => r.id)).toEqual([3]);
  });

  test("'none' means ignored with a null reason", () => {
    expect(selectRowsForView(rows, "ignored", "none").map((r) => r.id)).toEqual([4]);
  });

  test("a reason filter is ignored on every other tab", () => {
    expect(selectRowsForView(rows, "todo", "language").map((r) => r.id)).toEqual([1]);
  });
});

describe("countByView", () => {
  test("counts each status plus the total, unaffected by any filter", () => {
    const rows = [
      tabRow({ id: 1, status: "todo" }),
      tabRow({ id: 2, status: "todo" }),
      tabRow({ id: 3, status: "applied" }),
      tabRow({ id: 4, status: "ignored" }),
    ];
    expect(countByView(rows)).toEqual({ todo: 2, applied: 1, ignored: 1, all: 4 });
  });

  test("all-zero counts for an empty vacancy list", () => {
    expect(countByView([])).toEqual({ todo: 0, applied: 0, ignored: 0, all: 0 });
  });
});

describe("resolveShow", () => {
  test("defaults to 10 when absent", () => {
    expect(resolveShow(undefined)).toBe(10);
  });

  test("accepts 20 and all", () => {
    expect(resolveShow("20")).toBe(20);
    expect(resolveShow("all")).toBe("all");
  });

  test("falls back to 10 for any other value", () => {
    expect(resolveShow("bogus")).toBe(10);
    expect(resolveShow("200")).toBe(10);
  });

  test("takes the first element when given an array", () => {
    expect(resolveShow(["20", "all"])).toBe(20);
    expect(resolveShow(["bogus"])).toBe(10);
  });
});

describe("sliceRowsForShow", () => {
  const rows = [tabRow({ id: 1 }), tabRow({ id: 2 }), tabRow({ id: 3 })];

  test("show=10 slices to the first 10 (or fewer)", () => {
    expect(sliceRowsForShow(rows, 10).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("show=20 slices to the first 20", () => {
    expect(sliceRowsForShow(rows, 20).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("show='all' returns every row", () => {
    expect(sliceRowsForShow(rows, "all")).toEqual(rows);
  });

  test("returns an empty array for an empty list", () => {
    expect(sliceRowsForShow([], 10)).toEqual([]);
  });
});

describe("describeShownRows", () => {
  test("returns null for 0 rows (nothing to report)", () => {
    expect(describeShownRows(0, 10)).toBeNull();
  });

  test("returns null at exactly 10 rows (not 'more than 10')", () => {
    expect(describeShownRows(10, 10)).toBeNull();
  });

  test("15 total, show=10: Read more to show=20", () => {
    expect(describeShownRows(15, 10)).toEqual({
      shown: 10,
      total: 15,
      more: { label: "Read more", show: "20" },
    });
  });

  test("15 total, show=20: every row visible, no link", () => {
    expect(describeShownRows(15, 20)).toEqual({ shown: 15, total: 15, more: null });
  });

  test("20 total, show=10: Read more to show=20", () => {
    expect(describeShownRows(20, 10)).toEqual({
      shown: 10,
      total: 20,
      more: { label: "Read more", show: "20" },
    });
  });

  test("20 total, show=20: every row visible, no link", () => {
    expect(describeShownRows(20, 20)).toEqual({ shown: 20, total: 20, more: null });
  });

  test("21 total, show=20: Show all (21) link", () => {
    expect(describeShownRows(21, 20)).toEqual({
      shown: 20,
      total: 21,
      more: { label: "Show all (21)", show: "all" },
    });
  });

  test("21 total, show='all': every row visible, no link", () => {
    expect(describeShownRows(21, "all")).toEqual({ shown: 21, total: 21, more: null });
  });
});
