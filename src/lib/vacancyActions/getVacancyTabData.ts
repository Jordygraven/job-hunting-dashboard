import "server-only";

import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getVacancyStatuses } from "./getVacancyStatuses";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveShow,
  resolveView,
  selectRowsForView,
  sliceRowsForShow,
  type ShowParam,
  type VacancyTabCounts,
  type VacancyTabRow,
  type VacancyTabView,
} from "./vacancyTabs";
import type { IgnoreReason } from "./types";

export type VacancyTabSearchParams = {
  view?: string | string[];
  reason?: string | string[];
  show?: string | string[];
};

export type VacancyTabData = {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  counts: VacancyTabCounts;
  rows: VacancyTabRow[];
  show: ShowParam;
  filteredCount: number;
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, statuses] = await Promise.all([getVacancies(), getVacancyStatuses()]);

  const allRows = vacancies.map((vacancy) =>
    buildVacancyTabRow(vacancy, statuses.get(vacancy.id) ?? { status: "todo" })
  );

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);
  const show = resolveShow(params.show);
  const filteredRows = selectRowsForView(allRows, view, reasonFilter);

  return {
    view,
    reasonFilter,
    show,
    counts: countByView(allRows),
    rows: sliceRowsForShow(filteredRows, show),
    filteredCount: filteredRows.length,
  };
}
