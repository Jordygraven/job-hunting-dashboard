import { describe, expect, test } from "vitest";
import {
  distinctCompaniesSorted,
  matchesVacancyFilters,
  resolveVacancyFilters,
  type VacancyFilters,
} from "./vacancyFilters";
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
    ignoredOn: null,
    ignoreReason: null,
    ...overrides,
  };
}

const NO_FILTERS: VacancyFilters = { q: null, company: null, from: null, to: null };

describe("resolveVacancyFilters", () => {
  test("trims and lowercases q, treating empty or whitespace-only as absent", () => {
    expect(resolveVacancyFilters({ q: "  Engineer  " }).q).toBe("engineer");
    expect(resolveVacancyFilters({ q: "   " }).q).toBeNull();
    expect(resolveVacancyFilters({}).q).toBeNull();
  });

  test("caps q at 100 characters", () => {
    const long = "a".repeat(150);
    expect(resolveVacancyFilters({ q: long }).q).toBe("a".repeat(100));
  });

  test("takes the first value when q is given as an array (repeated param)", () => {
    expect(resolveVacancyFilters({ q: ["first", "second"] }).q).toBe("first");
  });

  test("trims company, treating empty as absent", () => {
    expect(resolveVacancyFilters({ company: "  Acme  " }).company).toBe("Acme");
    expect(resolveVacancyFilters({ company: "" }).company).toBeNull();
  });

  test("accepts a valid YYYY-MM-DD from/to", () => {
    expect(resolveVacancyFilters({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      q: null,
      company: null,
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  test("ignores a malformed or non-existent calendar date", () => {
    expect(resolveVacancyFilters({ from: "2026-02-30" }).from).toBeNull();
    expect(resolveVacancyFilters({ from: "not-a-date" }).from).toBeNull();
    expect(resolveVacancyFilters({ to: "2026-10-1" }).to).toBeNull();
  });
});

describe("matchesVacancyFilters", () => {
  test("matches when no filters are set", () => {
    expect(matchesVacancyFilters(row(), NO_FILTERS)).toBe(true);
  });

  test("q matches a partial, case-insensitive substring of title, company, or location independently", () => {
    const r = row({ title: "Backend Engineer", company: "Acme Corp", location: "Kuala Lumpur" });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "engineer" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "acme" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "lumpur" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "nope" })).toBe(false);
  });

  test("q never matches across a field boundary (fields are checked separately, not concatenated)", () => {
    const r = row({ title: "Backend", company: "Rolling Inc", location: "KL" });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "ndroll" })).toBe(false);
  });

  test("q against a null location doesn't crash and doesn't false-match", () => {
    const r = row({ location: null });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "kl" })).toBe(false);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, q: "engineer" })).toBe(true);
  });

  test("company is an exact, case-sensitive match", () => {
    const r = row({ company: "Acme" });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, company: "Acme" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, company: "acme" })).toBe(false);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, company: "Other" })).toBe(false);
  });

  test("date range is inclusive on both ends, compared as KL calendar days", () => {
    // 2026-10-01T20:00:00Z is 2026-10-02 in Asia/Kuala_Lumpur (UTC+8)
    const r = row({ firstSeenAt: "2026-10-01T20:00:00.000Z" });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, from: "2026-10-02", to: "2026-10-02" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, from: "2026-10-01", to: "2026-10-01" })).toBe(false);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, from: "2026-10-02" })).toBe(true);
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, to: "2026-10-02" })).toBe(true);
  });

  test("from after to yields no matches, even for a row that would satisfy either bound alone", () => {
    const r = row({ firstSeenAt: "2026-10-02T00:00:00.000Z" });
    expect(matchesVacancyFilters(r, { ...NO_FILTERS, from: "2026-10-05", to: "2026-10-01" })).toBe(false);
  });

  test("all filters combine with AND", () => {
    const r = row({ title: "Engineer", company: "Acme", firstSeenAt: "2026-10-02T00:00:00.000Z" });
    expect(
      matchesVacancyFilters(r, { q: "engineer", company: "Acme", from: "2026-10-01", to: "2026-10-03" })
    ).toBe(true);
    expect(
      matchesVacancyFilters(r, { q: "engineer", company: "Other", from: "2026-10-01", to: "2026-10-03" })
    ).toBe(false);
  });
});

describe("distinctCompaniesSorted", () => {
  test("dedupes and sorts A to Z, case-insensitively", () => {
    const companies = [{ company: "acme" }, { company: "Beta" }, { company: "amp" }, { company: "acme" }];
    expect(distinctCompaniesSorted(companies)).toEqual(["acme", "amp", "Beta"]);
  });

  test("returns an empty list for no rows", () => {
    expect(distinctCompaniesSorted([])).toEqual([]);
  });
});
