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

export function firstOf(value: string | string[] | undefined): string | undefined {
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

export type VacancyStatusFilter = VacancyTabRow["status"];

const STATUS_FILTERS: readonly VacancyStatusFilter[] = ["todo", "applied", "ignored"];

export function resolveStatusFilter(
  view: VacancyTabView,
  value: string | string[] | undefined
): VacancyStatusFilter | null {
  if (view !== "all") {
    return null;
  }
  const candidate = firstOf(value);
  return candidate !== undefined && (STATUS_FILTERS as readonly string[]).includes(candidate)
    ? (candidate as VacancyStatusFilter)
    : null;
}

export const STATUS_LABELS: Record<VacancyTabRow["status"], string> = {
  todo: "To do",
  applied: "Applied",
  ignored: "Ignored",
};

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

export type ShowParam = 10 | 20 | "all";

export function resolveShow(value: string | string[] | undefined): ShowParam {
  const candidate = firstOf(value);
  if (candidate === "20") {
    return 20;
  }
  if (candidate === "all") {
    return "all";
  }
  return 10;
}

export function sliceRowsForShow(rows: VacancyTabRow[], show: ShowParam): VacancyTabRow[] {
  return show === "all" ? rows : rows.slice(0, show);
}

export function describeShownRows(
  filteredCount: number,
  show: ShowParam
): { shown: number; total: number; more: { label: string; show: "20" | "all" } | null } | null {
  if (filteredCount <= 10) {
    return null;
  }
  const shown = show === "all" ? filteredCount : Math.min(show, filteredCount);
  if (shown >= filteredCount) {
    return { shown: filteredCount, total: filteredCount, more: null };
  }
  if (show === 10) {
    return { shown, total: filteredCount, more: { label: "Read more", show: "20" } };
  }
  return { shown, total: filteredCount, more: { label: `Show all (${filteredCount})`, show: "all" } };
}
