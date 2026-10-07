import "server-only";

import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getVacancyStatuses } from "./getVacancyStatuses";
import { distinctCompaniesSorted, matchesVacancyFilters, resolveVacancyFilters } from "./vacancyFilters";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveShow,
  resolveStatusFilter,
  resolveView,
  selectRowsForView,
  sliceRowsForShow,
  type ShowParam,
  type VacancyStatusFilter,
  type VacancyTabCounts,
  type VacancyTabRow,
  type VacancyTabView,
} from "./vacancyTabs";
import type { IgnoreReason } from "./types";

export type VacancyTabSearchParams = {
  view?: string | string[];
  reason?: string | string[];
  show?: string | string[];
  q?: string | string[];
  company?: string | string[];
  from?: string | string[];
  to?: string | string[];
  status?: string | string[];
};

export type VacancyTabData = {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  statusFilter: VacancyStatusFilter | null;
  counts: VacancyTabCounts;
  rows: VacancyTabRow[];
  show: ShowParam;
  filteredCount: number;
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
  companies: string[];
  hasActiveFilters: boolean;
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, statuses] = await Promise.all([getVacancies(), getVacancyStatuses()]);

  const allRows = vacancies.map((vacancy) =>
    buildVacancyTabRow(vacancy, statuses.get(vacancy.id) ?? { status: "todo" })
  );

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);
  const statusFilter = resolveStatusFilter(view, params.status);
  const show = resolveShow(params.show);
  const filters = resolveVacancyFilters(params);

  const commonFilteredRows = allRows.filter((row) => matchesVacancyFilters(row, filters));
  const counts = countByView(commonFilteredRows);

  let filteredRows = selectRowsForView(commonFilteredRows, view, reasonFilter);
  if (statusFilter) {
    filteredRows = filteredRows.filter((row) => row.status === statusFilter);
  }

  return {
    view,
    reasonFilter,
    statusFilter,
    show,
    q: filters.q,
    company: filters.company,
    from: filters.from,
    to: filters.to,
    companies: distinctCompaniesSorted(allRows),
    counts,
    rows: sliceRowsForShow(filteredRows, show),
    filteredCount: filteredRows.length,
    hasActiveFilters: Boolean(filters.q || filters.company || filters.from || filters.to || statusFilter),
  };
}
