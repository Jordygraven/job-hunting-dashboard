import "server-only";

import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getVacancyStatuses } from "./getVacancyStatuses";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveView,
  selectRowsForView,
  type VacancyTabCounts,
  type VacancyTabRow,
  type VacancyTabView,
} from "./vacancyTabs";
import type { IgnoreReason } from "./types";

export type VacancyTabSearchParams = {
  view?: string | string[];
  reason?: string | string[];
};

export type VacancyTabData = {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  counts: VacancyTabCounts;
  rows: VacancyTabRow[];
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, statuses] = await Promise.all([getVacancies(), getVacancyStatuses()]);

  const allRows = vacancies.map((vacancy) =>
    buildVacancyTabRow(vacancy, statuses.get(vacancy.id) ?? { status: "todo" })
  );

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);

  return {
    view,
    reasonFilter,
    counts: countByView(allRows),
    rows: selectRowsForView(allRows, view, reasonFilter),
  };
}
