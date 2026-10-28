import { beforeEach, describe, expect, test, vi } from "vitest";

let getVacanciesMock: any;
let getVacancyFlagsMock: any;

vi.mock("@/lib/vacancies/getVacancies", () => ({
  getVacancies: (...args: any[]) => getVacanciesMock(...args),
}));
vi.mock("./getVacancyFlags", () => ({
  getVacancyFlags: (...args: any[]) => getVacancyFlagsMock(...args),
}));

import { getVacancyTabData } from "./getVacancyTabData";

beforeEach(() => {
  getVacanciesMock = vi.fn();
  getVacancyFlagsMock = vi.fn();
});

const VACANCIES = [
  { id: 1, title: "A", company: "Co A", location: "KL", url: "https://x/1", firstSeenAt: "2026-10-03T00:00:00.000Z" },
  { id: 2, title: "B", company: "Co B", location: null, url: "https://x/2", firstSeenAt: "2026-10-02T00:00:00.000Z" },
  { id: 3, title: "C", company: "Co C", location: "Penang", url: "https://x/3", firstSeenAt: "2026-10-01T00:00:00.000Z" },
];

const EMPTY_COUNTS = { todo: 0, applied: 0, success: 0, rejected: 0, ignored: 0, all: 0, interest: 0, autodraft: 0 };

describe("getVacancyTabData", () => {
  test("combines vacancies with statuses, defaults to the todo tab, keeps newest-first order", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [2, { status: { status: "applied", appliedOn: "2026-10-02" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
        [3, { status: { status: "ignored", reason: "other", date: "2026-10-01" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const result = await getVacancyTabData({});

    expect(result.view).toBe("todo");
    expect(result.reasonFilter).toBeNull();
    expect(result.counts).toEqual({ ...EMPTY_COUNTS, todo: 1, applied: 1, ignored: 1, all: 3 });
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });

  test("pilot=1 keeps only pilot rows, flags hasActiveFilters, leaves tab counts unchanged", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([[2, { status: { status: "todo" }, starred: false, autoDraft: false, pilot: true, drafted: false }]])
    );

    const plain = await getVacancyTabData({});
    const result = await getVacancyTabData({ pilot: "1" });

    expect(result.rows.map((r) => r.id)).toEqual([2]);
    expect(result.filteredCount).toBe(1);
    expect(result.pilot).toBe(true);
    expect(result.hasActiveFilters).toBe(true);
    expect(result.counts).toEqual(plain.counts);
    expect(plain.pilot).toBe(false);
    expect(plain.hasActiveFilters).toBe(false);
  });

  test("passes autoDraft, pilot and drafted flags through to the row", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([[1, { status: { status: "todo" }, starred: false, autoDraft: true, pilot: true, drafted: true }]])
    );

    const result = await getVacancyTabData({});

    expect(result.rows.find((r) => r.id === 1)).toMatchObject({
      status: "todo",
      autoDraft: true,
      pilot: true,
      drafted: true,
    });
  });

  test("a vacancy with no status row at all is todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all" });

    expect(result.rows.map((r) => r.status)).toEqual(["todo", "todo", "todo"]);
  });

  test("the reason filter only narrows the ignored tab's rows, never its counts", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [2, { status: { status: "ignored", reason: "language", date: "2026-10-02" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
        [3, { status: { status: "ignored", reason: "other", date: "2026-10-01" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language" });

    expect(result.reasonFilter).toBe("language");
    expect(result.rows.map((r) => r.id)).toEqual([2]);
    expect(result.counts).toEqual({ ...EMPTY_COUNTS, todo: 1, ignored: 2, all: 3 });
  });

  test("an unknown view param falls back to todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "bogus" });

    expect(result.view).toBe("todo");
  });

  test("defaults show to 10 and slices rows, reporting the pre-slice filtered count", async () => {
    const manyVacancies = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Job ${i + 1}`,
      company: "Co",
      location: null,
      url: `https://x/${i + 1}`,
      firstSeenAt: "2026-10-01T00:00:00.000Z",
    }));
    getVacanciesMock.mockResolvedValue(manyVacancies);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({});

    expect(result.show).toBe(10);
    expect(result.rows).toHaveLength(10);
    expect(result.filteredCount).toBe(12);
  });

  test("show=20 widens the slice", async () => {
    const manyVacancies = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Job ${i + 1}`,
      company: "Co",
      location: null,
      url: `https://x/${i + 1}`,
      firstSeenAt: "2026-10-01T00:00:00.000Z",
    }));
    getVacanciesMock.mockResolvedValue(manyVacancies);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ show: "20" });

    expect(result.show).toBe(20);
    expect(result.rows).toHaveLength(12);
    expect(result.filteredCount).toBe(12);
  });

  test("filteredCount reflects the reason filter, not the global ignored count", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [2, { status: { status: "ignored", reason: "language", date: "2026-10-02" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
        [3, { status: { status: "ignored", reason: "other", date: "2026-10-01" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language" });

    expect(result.filteredCount).toBe(1);
    expect(result.counts.ignored).toBe(2);
  });

  test("q narrows rows on every tab, partial and case-insensitive", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all", q: "CO B" });

    expect(result.rows.map((r) => r.id)).toEqual([2]);
    expect(result.q).toBe("co b");
  });

  test("company is an exact match; a non-existent company yields zero rows, not an error", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const exact = await getVacancyTabData({ view: "all", company: "Co B" });
    expect(exact.rows.map((r) => r.id)).toEqual([2]);

    const missing = await getVacancyTabData({ view: "all", company: "Nope Inc" });
    expect(missing.rows).toEqual([]);
    expect(missing.filteredCount).toBe(0);
  });

  test("from/to narrow by the KL calendar day of firstSeenAt; from after to yields zero rows", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const inRange = await getVacancyTabData({ view: "all", from: "2026-10-02", to: "2026-10-03" });
    expect(inRange.rows.map((r) => r.id).sort()).toEqual([1, 2]);

    const empty = await getVacancyTabData({ view: "all", from: "2026-10-05", to: "2026-10-01" });
    expect(empty.rows).toEqual([]);
  });

  test("counts add up with company filter active, ignoring status and reason; interest is not folded into all", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [2, { status: { status: "ignored", reason: "language", date: "2026-10-02" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
        [3, { status: { status: "applied", appliedOn: "2026-10-01" }, starred: true, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language", company: "Co A" });

    expect(result.counts).toEqual({ ...EMPTY_COUNTS, todo: 1, all: 1 });
    expect(result.counts.todo + result.counts.applied + result.counts.success + result.counts.rejected + result.counts.ignored).toBe(
      result.counts.all
    );
  });

  test("status narrows rows on the all and interest tabs; it's a no-op elsewhere", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([[2, { status: { status: "applied", appliedOn: "2026-10-02" }, starred: true, autoDraft: false, pilot: false, drafted: false }]])
    );

    const onAll = await getVacancyTabData({ view: "all", status: "applied" });
    expect(onAll.rows.map((r) => r.id)).toEqual([2]);
    expect(onAll.statusFilter).toBe("applied");

    const onInterest = await getVacancyTabData({ view: "interest", status: "applied" });
    expect(onInterest.rows.map((r) => r.id)).toEqual([2]);
    expect(onInterest.statusFilter).toBe("applied");

    const onTodo = await getVacancyTabData({ view: "todo", status: "applied" });
    expect(onTodo.statusFilter).toBeNull();
    expect(onTodo.rows.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  test("the interest tab selects starred rows regardless of status", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [1, { status: { status: "todo" }, starred: true, autoDraft: false, pilot: false, drafted: false }],
        [2, { status: { status: "applied", appliedOn: "2026-10-01" }, starred: true, autoDraft: false, pilot: false, drafted: false }],
        [3, { status: { status: "ignored", reason: "other", date: "2026-10-01" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const result = await getVacancyTabData({ view: "interest" });

    expect(result.rows.map((r) => r.id).sort()).toEqual([1, 2]);
    expect(result.counts.interest).toBe(2);
  });

  test("the success and rejected tabs select by status", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [1, { status: { status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
        [2, { status: { status: "rejected", appliedOn: "2026-10-01", outcomeOn: "2026-10-06" }, starred: false, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const success = await getVacancyTabData({ view: "success" });
    expect(success.rows.map((r) => r.id)).toEqual([1]);

    const rejected = await getVacancyTabData({ view: "rejected" });
    expect(rejected.rows.map((r) => r.id)).toEqual([2]);
  });

  test("q/company/from/to filters apply on the interest, success, and rejected tabs too", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(
      new Map([
        [1, { status: { status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" }, starred: true, autoDraft: false, pilot: false, drafted: false }],
        [2, { status: { status: "success", appliedOn: "2026-10-01", outcomeOn: "2026-10-05" }, starred: true, autoDraft: false, pilot: false, drafted: false }],
      ])
    );

    const interestByCompany = await getVacancyTabData({ view: "interest", company: "Co A" });
    expect(interestByCompany.rows.map((r) => r.id)).toEqual([1]);

    const successByQuery = await getVacancyTabData({ view: "success", q: "co b" });
    expect(successByQuery.rows.map((r) => r.id)).toEqual([2]);
  });

  test("companies lists every distinct company across all vacancies, regardless of active filters", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all", company: "Co A" });

    expect(result.companies).toEqual(["Co A", "Co B", "Co C"]);
  });

  test("hasActiveFilters is false with no params, true when any filter is set", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    expect((await getVacancyTabData({})).hasActiveFilters).toBe(false);
    expect((await getVacancyTabData({ q: "a" })).hasActiveFilters).toBe(true);
    expect((await getVacancyTabData({ company: "Co A" })).hasActiveFilters).toBe(true);
    expect((await getVacancyTabData({ from: "2026-10-01" })).hasActiveFilters).toBe(true);
    expect((await getVacancyTabData({ view: "all", status: "todo" })).hasActiveFilters).toBe(true);
    expect((await getVacancyTabData({ view: "interest", status: "todo" })).hasActiveFilters).toBe(true);
  });

  test("with no sort param, row order matches today's default (DB order) exactly when nothing is starred", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all" });

    expect(result.sort).toBeNull();
    expect(result.dir).toBeNull();
    expect(result.rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("with no sort param, a starred row floats to the top of the default order", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map([[3, { status: { status: "todo" }, starred: true, autoDraft: false, pilot: false, drafted: false }]]));

    const result = await getVacancyTabData({ view: "all" });

    expect(result.rows.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  test("an invalid sort or dir param is ignored, falling back to default order", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const badColumn = await getVacancyTabData({ view: "all", sort: "nope", dir: "asc" });
    expect(badColumn.sort).toBeNull();
    expect(badColumn.rows.map((r) => r.id)).toEqual([1, 2, 3]);

    const badDir = await getVacancyTabData({ view: "all", sort: "title", dir: "sideways" });
    expect(badDir.dir).toBeNull();
    expect(badDir.rows.map((r) => r.id)).toEqual([1, 2, 3]);

    const columnNotOnTab = await getVacancyTabData({ view: "todo", sort: "status", dir: "asc" });
    expect(columnNotOnTab.sort).toBeNull();
  });

  test("a valid sort changes row order but not counts or filteredCount", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all", sort: "title", dir: "desc" });

    expect(result.sort).toBe("title");
    expect(result.dir).toBe("desc");
    expect(result.rows.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(result.counts).toEqual({ ...EMPTY_COUNTS, todo: 3, all: 3 });
    expect(result.filteredCount).toBe(3);
  });

  test("sort is applied to the full filtered set before the show slice", async () => {
    const manyVacancies = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Job ${String(i + 1).padStart(2, "0")}`,
      company: "Co",
      location: null,
      url: `https://x/${i + 1}`,
      firstSeenAt: "2026-10-01T00:00:00.000Z",
    }));
    getVacanciesMock.mockResolvedValue(manyVacancies);
    getVacancyFlagsMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all", sort: "title", dir: "asc" });

    expect(result.show).toBe(10);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].title).toBe("Job 01");
    expect(result.filteredCount).toBe(12);
  });
});
