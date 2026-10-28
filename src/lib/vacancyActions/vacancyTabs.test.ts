import { describe, expect, test } from "vitest";
import {
  buildVacancyTabRow,
  countByView,
  describeShownRows,
  resolveReasonFilter,
  resolveShow,
  resolveStatusFilter,
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

const NO_AUTOMATION = { autoDraft: false, pilot: false, drafted: false };

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
    outcomeOn: null,
    ignoredOn: null,
    ignoreReason: null,
    starred: false,
    autoDraft: false,
    pilot: false,
    drafted: false,
    ...overrides,
  };
}

describe("resolveView", () => {
  test("defaults to todo when no param is given", () => {
    expect(resolveView(undefined)).toBe("todo");
  });

  test("accepts each known view", () => {
    expect(resolveView("todo")).toBe("todo");
    expect(resolveView("interest")).toBe("interest");
    expect(resolveView("applied")).toBe("applied");
    expect(resolveView("all")).toBe("all");
    expect(resolveView("success")).toBe("success");
    expect(resolveView("rejected")).toBe("rejected");
    expect(resolveView("ignored")).toBe("ignored");
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
    expect(resolveReasonFilter("ignored", "duplicate")).toBe("duplicate");
    expect(resolveReasonFilter("ignored", "other")).toBe("other");
    expect(resolveReasonFilter("ignored", "none")).toBe("none");
  });

  test("is null when absent or unknown on the ignored tab (meaning: all reasons)", () => {
    expect(resolveReasonFilter("ignored", undefined)).toBeNull();
    expect(resolveReasonFilter("ignored", "bogus")).toBeNull();
  });
});

describe("resolveStatusFilter", () => {
  test("is always null outside the all/interest tabs, even with a valid-looking status", () => {
    expect(resolveStatusFilter("todo", "applied")).toBeNull();
    expect(resolveStatusFilter("applied", "todo")).toBeNull();
    expect(resolveStatusFilter("ignored", "ignored")).toBeNull();
  });

  test("accepts each known status on the all tab", () => {
    expect(resolveStatusFilter("all", "todo")).toBe("todo");
    expect(resolveStatusFilter("all", "applied")).toBe("applied");
    expect(resolveStatusFilter("all", "success")).toBe("success");
    expect(resolveStatusFilter("all", "rejected")).toBe("rejected");
    expect(resolveStatusFilter("all", "ignored")).toBe("ignored");
  });

  test("accepts each known status on the interest tab too", () => {
    expect(resolveStatusFilter("interest", "applied")).toBe("applied");
    expect(resolveStatusFilter("interest", "success")).toBe("success");
  });

  test("is null when absent or unknown on the all tab (meaning: all statuses)", () => {
    expect(resolveStatusFilter("all", undefined)).toBeNull();
    expect(resolveStatusFilter("all", "bogus")).toBeNull();
  });
});

describe("buildVacancyTabRow", () => {
  test("todo status carries no date/reason, starred passed through", () => {
    const status: VacancyStatus = { status: "todo" };
    expect(buildVacancyTabRow(vacancy(), status, false, NO_AUTOMATION)).toEqual(tabRow({ status: "todo", starred: false }));
    expect(buildVacancyTabRow(vacancy(), status, true, NO_AUTOMATION)).toEqual(tabRow({ status: "todo", starred: true }));
  });

  test("applied status carries appliedOn, no outcomeOn/ignoredOn/reason", () => {
    const status: VacancyStatus = { status: "applied", appliedOn: "2026-10-02" };
    expect(buildVacancyTabRow(vacancy(), status, false, NO_AUTOMATION)).toEqual(
      tabRow({ status: "applied", appliedOn: "2026-10-02" })
    );
  });

  test("ignored status carries ignoredOn and reason (possibly null)", () => {
    const status: VacancyStatus = { status: "ignored", reason: "interest", date: "2026-10-03" };
    expect(buildVacancyTabRow(vacancy(), status, false, NO_AUTOMATION)).toEqual(
      tabRow({ status: "ignored", ignoredOn: "2026-10-03", ignoreReason: "interest" })
    );
  });

  test("success status carries both appliedOn and outcomeOn", () => {
    const status: VacancyStatus = { status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" };
    expect(buildVacancyTabRow(vacancy(), status, false, NO_AUTOMATION)).toEqual(
      tabRow({ status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" })
    );
  });

  test("rejected status carries both appliedOn and outcomeOn", () => {
    const status: VacancyStatus = { status: "rejected", appliedOn: "2026-10-01", outcomeOn: "2026-10-08" };
    expect(buildVacancyTabRow(vacancy(), status, true, NO_AUTOMATION)).toEqual(
      tabRow({ status: "rejected", appliedOn: "2026-10-01", outcomeOn: "2026-10-08", starred: true })
    );
  });
});

describe("selectRowsForView", () => {
  const rows = [
    tabRow({ id: 1, status: "todo", starred: true }),
    tabRow({ id: 2, status: "applied", appliedOn: "2026-10-01", starred: true }),
    tabRow({ id: 3, status: "ignored", ignoreReason: "language", ignoredOn: "2026-10-01" }),
    tabRow({ id: 4, status: "ignored", ignoreReason: null, ignoredOn: "2026-10-02" }),
    tabRow({ id: 5, status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" }),
    tabRow({ id: 6, status: "rejected", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" }),
  ];

  test("all returns every row, preserving order", () => {
    expect(selectRowsForView(rows, "all", null).map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("todo/applied/ignored/success/rejected each return only their own status", () => {
    expect(selectRowsForView(rows, "todo", null).map((r) => r.id)).toEqual([1]);
    expect(selectRowsForView(rows, "applied", null).map((r) => r.id)).toEqual([2]);
    expect(selectRowsForView(rows, "ignored", null).map((r) => r.id)).toEqual([3, 4]);
    expect(selectRowsForView(rows, "success", null).map((r) => r.id)).toEqual([5]);
    expect(selectRowsForView(rows, "rejected", null).map((r) => r.id)).toEqual([6]);
  });

  test("interest returns only starred rows, ignoring status entirely", () => {
    expect(selectRowsForView(rows, "interest", null).map((r) => r.id)).toEqual([1, 2]);
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
  test("counts each status plus the total, unaffected by any filter; all sums the five statuses", () => {
    const rows = [
      tabRow({ id: 1, status: "todo" }),
      tabRow({ id: 2, status: "todo" }),
      tabRow({ id: 3, status: "applied" }),
      tabRow({ id: 4, status: "success" }),
      tabRow({ id: 5, status: "rejected" }),
      tabRow({ id: 6, status: "ignored" }),
    ];
    expect(countByView(rows)).toEqual({
      todo: 2,
      applied: 1,
      success: 1,
      rejected: 1,
      ignored: 1,
      all: 6,
      interest: 0,
    });
  });

  test("interest counts starred rows across every status and is not folded into all", () => {
    const rows = [
      tabRow({ id: 1, status: "todo", starred: true }),
      tabRow({ id: 2, status: "applied", starred: true }),
      tabRow({ id: 3, status: "success", starred: false }),
    ];
    const counts = countByView(rows);
    expect(counts.interest).toBe(2);
    expect(counts.all).toBe(3);
    expect(counts.todo + counts.applied + counts.success + counts.rejected + counts.ignored).toBe(counts.all);
  });

  test("all-zero counts for an empty vacancy list", () => {
    expect(countByView([])).toEqual({
      todo: 0,
      applied: 0,
      success: 0,
      rejected: 0,
      ignored: 0,
      all: 0,
      interest: 0,
    });
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
