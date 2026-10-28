import "server-only";

import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getVacancyFlags } from "./getVacancyFlags";
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
import { resolveSort, sortRows, type SortDir, type SortableColumnKey } from "./vacancySort";
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
  sort?: string | string[];
  dir?: string | string[];
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
  sort: SortableColumnKey | null;
  dir: SortDir | null;
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, flags] = await Promise.all([getVacancies(), getVacancyFlags()]);

  const allRows = vacancies.map((vacancy) => {
    const flag = flags.get(vacancy.id) ?? {
      status: { status: "todo" as const },
      starred: false,
      autoDraft: false,
      pilot: false,
      drafted: false,
    };
    return buildVacancyTabRow(vacancy, flag.status, flag.starred, {
      autoDraft: flag.autoDraft,
      pilot: flag.pilot,
      drafted: flag.drafted,
    });
  });

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);
  const statusFilter = resolveStatusFilter(view, params.status);
  const show = resolveShow(params.show);
  const filters = resolveVacancyFilters(params);
  const { sort, dir } = resolveSort(view, params.sort, params.dir);

  const commonFilteredRows = allRows.filter((row) => matchesVacancyFilters(row, filters));
  const counts = countByView(commonFilteredRows);

  let filteredRows = selectRowsForView(commonFilteredRows, view, reasonFilter);
  if (statusFilter) {
    filteredRows = filteredRows.filter((row) => row.status === statusFilter);
  }
  filteredRows = sortRows(filteredRows, sort, dir);

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
    sort,
    dir,
  };
}
