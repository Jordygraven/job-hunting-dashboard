import { beforeEach, describe, expect, test, vi } from "vitest";

let getVacanciesMock: any;
let getVacancyStatusesMock: any;

vi.mock("@/lib/vacancies/getVacancies", () => ({
  getVacancies: (...args: any[]) => getVacanciesMock(...args),
}));
vi.mock("./getVacancyStatuses", () => ({
  getVacancyStatuses: (...args: any[]) => getVacancyStatusesMock(...args),
}));

import { getVacancyTabData } from "./getVacancyTabData";

beforeEach(() => {
  getVacanciesMock = vi.fn();
  getVacancyStatusesMock = vi.fn();
});

const VACANCIES = [
  { id: 1, title: "A", company: "Co A", location: "KL", url: "https://x/1", firstSeenAt: "2026-10-03T00:00:00.000Z" },
  { id: 2, title: "B", company: "Co B", location: null, url: "https://x/2", firstSeenAt: "2026-10-02T00:00:00.000Z" },
  { id: 3, title: "C", company: "Co C", location: "Penang", url: "https://x/3", firstSeenAt: "2026-10-01T00:00:00.000Z" },
];

describe("getVacancyTabData", () => {
  test("combines vacancies with statuses, defaults to the todo tab, keeps newest-first order", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(
      new Map([
        [2, { status: "applied", appliedOn: "2026-10-02" }],
        [3, { status: "ignored", reason: "other", date: "2026-10-01" }],
      ])
    );

    const result = await getVacancyTabData({});

    expect(result.view).toBe("todo");
    expect(result.reasonFilter).toBeNull();
    expect(result.counts).toEqual({ todo: 1, applied: 1, ignored: 1, all: 3 });
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });

  test("a vacancy with no status row at all is todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all" });

    expect(result.rows.map((r) => r.status)).toEqual(["todo", "todo", "todo"]);
  });

  test("the reason filter only narrows the ignored tab's rows, never its counts", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(
      new Map([
        [2, { status: "ignored", reason: "language", date: "2026-10-02" }],
        [3, { status: "ignored", reason: "other", date: "2026-10-01" }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language" });

    expect(result.reasonFilter).toBe("language");
    expect(result.rows.map((r) => r.id)).toEqual([2]);
    expect(result.counts).toEqual({ todo: 1, applied: 0, ignored: 2, all: 3 });
  });

  test("an unknown view param falls back to todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(new Map());

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
    getVacancyStatusesMock.mockResolvedValue(new Map());

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
    getVacancyStatusesMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ show: "20" });

    expect(result.show).toBe(20);
    expect(result.rows).toHaveLength(12);
    expect(result.filteredCount).toBe(12);
  });

  test("filteredCount reflects the reason filter, not the global ignored count", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(
      new Map([
        [2, { status: "ignored", reason: "language", date: "2026-10-02" }],
        [3, { status: "ignored", reason: "other", date: "2026-10-01" }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language" });

    expect(result.filteredCount).toBe(1);
    expect(result.counts.ignored).toBe(2);
  });
});
