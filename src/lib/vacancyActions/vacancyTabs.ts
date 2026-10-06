import { IGNORE_REASONS } from "./validation";
import type { Vacancy } from "@/lib/vacancies/getVacancies";
import type { IgnoreReason, VacancyStatus } from "./types";

export type VacancyTabView = "todo" | "applied" | "ignored" | "all";

export type VacancyTabRow = {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
  status: "todo" | "applied" | "ignored";
  appliedOn: string | null;
  ignoredOn: string | null;
  ignoreReason: IgnoreReason | null;
};

export type VacancyTabCounts = {
  todo: number;
  applied: number;
  ignored: number;
  all: number;
};

const VIEWS: readonly VacancyTabView[] = ["todo", "applied", "ignored", "all"];
const REASON_FILTERS: readonly string[] = [...IGNORE_REASONS, "none"];

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveView(value: string | string[] | undefined): VacancyTabView {
  const candidate = firstOf(value);
  return (VIEWS as readonly string[]).includes(candidate ?? "") ? (candidate as VacancyTabView) : "todo";
}

export function resolveReasonFilter(
  view: VacancyTabView,
  value: string | string[] | undefined
): IgnoreReason | "none" | null {
  if (view !== "ignored") {
    return null;
  }
  const candidate = firstOf(value);
  return candidate !== undefined && REASON_FILTERS.includes(candidate)
    ? (candidate as IgnoreReason | "none")
    : null;
}

export function buildVacancyTabRow(vacancy: Vacancy, status: VacancyStatus): VacancyTabRow {
  return {
    id: vacancy.id,
    title: vacancy.title,
    company: vacancy.company,
    location: vacancy.location,
    url: vacancy.url,
    firstSeenAt: vacancy.firstSeenAt,
    status: status.status,
    appliedOn: status.status === "applied" ? status.appliedOn : null,
    ignoredOn: status.status === "ignored" ? status.date : null,
    ignoreReason: status.status === "ignored" ? status.reason : null,
  };
}

export function selectRowsForView(
  rows: VacancyTabRow[],
  view: VacancyTabView,
  reasonFilter: IgnoreReason | "none" | null
): VacancyTabRow[] {
  const byView = view === "all" ? rows : rows.filter((row) => row.status === view);
  if (view !== "ignored" || reasonFilter === null) {
    return byView;
  }
  return reasonFilter === "none"
    ? byView.filter((row) => row.ignoreReason === null)
    : byView.filter((row) => row.ignoreReason === reasonFilter);
}

export function countByView(rows: VacancyTabRow[]): VacancyTabCounts {
  return {
    todo: rows.filter((row) => row.status === "todo").length,
    applied: rows.filter((row) => row.status === "applied").length,
    ignored: rows.filter((row) => row.status === "ignored").length,
    all: rows.length,
  };
}
