import type { IgnoreReason } from "./types";
import { statusFilterAppliesToView, type ShowParam, type VacancyStatusFilter, type VacancyTabView } from "./vacancyTabs";
import { COLUMNS_BY_VIEW, type SortDir, type SortableColumnKey } from "./vacancySort";

export type VacancyHrefParams = {
  view: VacancyTabView;
  reasonFilter?: IgnoreReason | "none" | null;
  status?: VacancyStatusFilter | null;
  show?: ShowParam;
  q?: string | null;
  company?: string | null;
  from?: string | null;
  to?: string | null;
  pilot?: boolean;
  sort?: SortableColumnKey | null;
  dir?: SortDir | null;
};

export function buildVacancyHref(params: VacancyHrefParams): string {
  const searchParams = new URLSearchParams({ view: params.view });

  if (params.reasonFilter) {
    searchParams.set("reason", params.reasonFilter);
  }
  if (statusFilterAppliesToView(params.view) && params.status) {
    searchParams.set("status", params.status);
  }
  if (params.show && params.show !== 10) {
    searchParams.set("show", String(params.show));
  }
  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.company) {
    searchParams.set("company", params.company);
  }
  if (params.from) {
    searchParams.set("from", params.from);
  }
  if (params.to) {
    searchParams.set("to", params.to);
  }
  if (params.pilot) {
    searchParams.set("pilot", "1");
  }
  if (
    params.sort &&
    params.dir &&
    (COLUMNS_BY_VIEW[params.view] as readonly string[]).includes(params.sort)
  ) {
    searchParams.set("sort", params.sort);
    searchParams.set("dir", params.dir);
  }

  return `/?${searchParams.toString()}`;
}
