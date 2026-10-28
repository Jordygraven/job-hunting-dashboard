import { IGNORE_REASONS } from "./validation";
import type { Vacancy } from "@/lib/vacancies/getVacancies";
import type { IgnoreReason, VacancyStatus } from "./types";

export type VacancyTabView = "todo" | "interest" | "applied" | "all" | "success" | "rejected" | "ignored";

export type VacancyTabRow = {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
  status: "todo" | "applied" | "ignored" | "success" | "rejected";
  appliedOn: string | null;
  outcomeOn: string | null;
  ignoredOn: string | null;
  ignoreReason: IgnoreReason | null;
  starred: boolean;
  autoDraft: boolean;
  pilot: boolean;
  drafted: boolean;
};

export type VacancyTabCounts = {
  todo: number;
  applied: number;
  success: number;
  rejected: number;
  ignored: number;
  all: number;
  interest: number;
};

const VIEWS: readonly VacancyTabView[] = ["todo", "interest", "applied", "all", "success", "rejected", "ignored"];
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

const STATUS_FILTERS: readonly VacancyStatusFilter[] = ["todo", "applied", "success", "rejected", "ignored"];

// The status filter only applies on the "all" and "interest" tabs — the other
// tabs are already filtered to a single status, so a status filter there
// would be redundant.
export function statusFilterAppliesToView(view: VacancyTabView): boolean {
  return view === "all" || view === "interest";
}

export function resolveStatusFilter(
  view: VacancyTabView,
  value: string | string[] | undefined
): VacancyStatusFilter | null {
  if (!statusFilterAppliesToView(view)) {
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
  success: "Success",
  rejected: "Rejected",
  ignored: "Ignored",
};

export function buildVacancyTabRow(
  vacancy: Vacancy,
  status: VacancyStatus,
  starred: boolean,
  automation: Pick<VacancyTabRow, "autoDraft" | "pilot" | "drafted">
): VacancyTabRow {
  const appliedOn =
    status.status === "applied" || status.status === "success" || status.status === "rejected"
      ? status.appliedOn
      : null;
  const outcomeOn = status.status === "success" || status.status === "rejected" ? status.outcomeOn : null;

  return {
    id: vacancy.id,
    title: vacancy.title,
    company: vacancy.company,
    location: vacancy.location,
    url: vacancy.url,
    firstSeenAt: vacancy.firstSeenAt,
    status: status.status,
    appliedOn,
    outcomeOn,
    ignoredOn: status.status === "ignored" ? status.date : null,
    ignoreReason: status.status === "ignored" ? status.reason : null,
    starred,
    ...automation,
  };
}

export function selectRowsForView(
  rows: VacancyTabRow[],
  view: VacancyTabView,
  reasonFilter: IgnoreReason | "none" | null
): VacancyTabRow[] {
  const byView =
    view === "all"
      ? rows
      : view === "interest"
        ? rows.filter((row) => row.starred)
        : rows.filter((row) => row.status === view);
  if (view !== "ignored" || reasonFilter === null) {
    return byView;
  }
  return reasonFilter === "none"
    ? byView.filter((row) => row.ignoreReason === null)
    : byView.filter((row) => row.ignoreReason === reasonFilter);
}

export function countByView(rows: VacancyTabRow[]): VacancyTabCounts {
  const todo = rows.filter((row) => row.status === "todo").length;
  const applied = rows.filter((row) => row.status === "applied").length;
  const success = rows.filter((row) => row.status === "success").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;
  const ignored = rows.filter((row) => row.status === "ignored").length;
  const interest = rows.filter((row) => row.starred).length;

  return {
    todo,
    applied,
    success,
    rejected,
    ignored,
    all: todo + applied + success + rejected + ignored,
    interest,
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
