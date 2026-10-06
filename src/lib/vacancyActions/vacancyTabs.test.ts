import { describe, expect, test } from "vitest";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveView,
  selectRowsForView,
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
    expect(resolveReasonFilter("ignored", "location")).toBe("location");
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
    const status: VacancyStatus = { status: "ignored", reason: "location", date: "2026-10-03" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(
      tabRow({ status: "ignored", ignoredOn: "2026-10-03", ignoreReason: "location" })
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
