import { getKlDateString, isValidDateString } from "@/lib/format/kualaLumpurDate";
import { firstOf, type VacancyTabRow } from "./vacancyTabs";

const MAX_QUERY_LENGTH = 100;

export type VacancyFilters = {
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
};

function resolveSearchQuery(value: string | string[] | undefined): string | null {
  const trimmed = firstOf(value)?.trim();
  return trimmed ? trimmed.slice(0, MAX_QUERY_LENGTH).toLowerCase() : null;
}

function resolveCompany(value: string | string[] | undefined): string | null {
  const trimmed = firstOf(value)?.trim();
  return trimmed ? trimmed : null;
}

function resolveDateParam(value: string | string[] | undefined): string | null {
  const candidate = firstOf(value);
  return candidate !== undefined && isValidDateString(candidate) ? candidate : null;
}

export function resolveVacancyFilters(params: {
  q?: string | string[];
  company?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): VacancyFilters {
  return {
    q: resolveSearchQuery(params.q),
    company: resolveCompany(params.company),
    from: resolveDateParam(params.from),
    to: resolveDateParam(params.to),
  };
}

function matchesSearch(row: VacancyTabRow, q: string | null): boolean {
  if (q === null) {
    return true;
  }
  return [row.title, row.company, row.location ?? ""].some((field) =>
    field.toLowerCase().includes(q)
  );
}

export function matchesVacancyFilters(row: VacancyTabRow, filters: VacancyFilters): boolean {
  if (!matchesSearch(row, filters.q)) {
    return false;
  }
  if (filters.company && row.company !== filters.company) {
    return false;
  }
  if (filters.from || filters.to) {
    const klDate = getKlDateString(new Date(row.firstSeenAt));
    if (filters.from && klDate < filters.from) {
      return false;
    }
    if (filters.to && klDate > filters.to) {
      return false;
    }
  }
  return true;
}

export function distinctCompaniesSorted(rows: { company: string }[]): string[] {
  return Array.from(new Set(rows.map((row) => row.company))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
