import { firstOf, STATUS_LABELS, type VacancyTabRow, type VacancyTabView } from "./vacancyTabs";
import { REASON_LABELS } from "./validation";

export type SortableColumnKey =
  | "title"
  | "company"
  | "location"
  | "firstSeenAt"
  | "appliedOn"
  | "outcomeOn"
  | "ignoredOn"
  | "ignoreReason"
  | "status";

export type SortDir = "asc" | "desc";

export type SortState = { sort: SortableColumnKey | null; dir: SortDir | null };

type ColumnDef = {
  label: string;
  getValue: (row: VacancyTabRow) => string | null;
  compareValues?: (a: string, b: string) => number;
};

function localeCompareValues(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function plainCompareValues(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const COLUMN_DEFS: Record<SortableColumnKey, ColumnDef> = {
  title: { label: "Title", getValue: (row) => row.title },
  company: { label: "Company", getValue: (row) => row.company },
  location: { label: "Location", getValue: (row) => row.location },
  firstSeenAt: {
    label: "First seen",
    getValue: (row) => row.firstSeenAt,
    compareValues: plainCompareValues,
  },
  appliedOn: {
    label: "Applied on",
    getValue: (row) => row.appliedOn,
    compareValues: plainCompareValues,
  },
  outcomeOn: {
    label: "Outcome on",
    getValue: (row) => row.outcomeOn,
    compareValues: plainCompareValues,
  },
  ignoredOn: {
    label: "Ignored on",
    getValue: (row) => row.ignoredOn,
    compareValues: plainCompareValues,
  },
  ignoreReason: {
    label: "Reason",
    getValue: (row) => (row.ignoreReason ? REASON_LABELS[row.ignoreReason] : null),
  },
  status: {
    label: "Status",
    getValue: (row) => STATUS_LABELS[row.status],
  },
} satisfies Record<SortableColumnKey, ColumnDef>;

export const COLUMNS_BY_VIEW: Record<VacancyTabView, readonly SortableColumnKey[]> = {
  todo: ["title", "company", "location", "firstSeenAt"],
  interest: ["title", "company", "location", "firstSeenAt", "status"],
  applied: ["title", "company", "location", "firstSeenAt", "appliedOn"],
  success: ["title", "company", "location", "firstSeenAt", "appliedOn", "outcomeOn"],
  rejected: ["title", "company", "location", "firstSeenAt", "appliedOn", "outcomeOn"],
  ignored: ["title", "company", "location", "firstSeenAt", "ignoredOn", "ignoreReason"],
  all: ["title", "company", "location", "firstSeenAt", "status"],
  autodraft: ["title", "company", "location", "firstSeenAt", "status"],
};

export function columnLabel(column: SortableColumnKey): string {
  return COLUMN_DEFS[column].label;
}

function isValidSortDir(value: string | undefined): value is SortDir {
  return value === "asc" || value === "desc";
}

export function resolveSort(
  view: VacancyTabView,
  sortValue: string | string[] | undefined,
  dirValue: string | string[] | undefined
): SortState {
  const sortCandidate = firstOf(sortValue);
  const dirCandidate = firstOf(dirValue);

  const isValidColumn =
    sortCandidate !== undefined &&
    (COLUMNS_BY_VIEW[view] as readonly string[]).includes(sortCandidate);

  if (!isValidColumn || !isValidSortDir(dirCandidate)) {
    return { sort: null, dir: null };
  }

  return { sort: sortCandidate as SortableColumnKey, dir: dirCandidate };
}

export function nextSortState(
  column: SortableColumnKey,
  currentSort: SortableColumnKey | null,
  currentDir: SortDir | null
): SortState {
  if (currentSort !== column || currentDir === null) {
    return { sort: column, dir: "asc" };
  }
  if (currentDir === "asc") {
    return { sort: column, dir: "desc" };
  }
  return { sort: null, dir: null };
}

export function sortRows(
  rows: VacancyTabRow[],
  sort: SortableColumnKey | null,
  dir: SortDir | null
): VacancyTabRow[] {
  if (sort === null || dir === null) {
    // No explicit sort: starred rows float to the top, stable otherwise so
    // relative order within each group (starred / not starred) is preserved.
    return [...rows].sort((a, b) => Number(b.starred) - Number(a.starred));
  }

  const { getValue, compareValues = localeCompareValues } = COLUMN_DEFS[sort];
  const sign = dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);
    const aEmpty = aValue === null || aValue === "";
    const bEmpty = bValue === null || bValue === "";

    if (aEmpty && bEmpty) {
      return a.id - b.id;
    }
    if (aEmpty) {
      return 1;
    }
    if (bEmpty) {
      return -1;
    }

    const cmp = compareValues(aValue, bValue) * sign;
    return cmp !== 0 ? cmp : a.id - b.id;
  });
}
