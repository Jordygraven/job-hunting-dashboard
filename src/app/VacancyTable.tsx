import Link from "next/link";
import { formatKlDate } from "@/lib/format/kualaLumpurTime";
import { STATUS_LABELS, type VacancyTabRow, type VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import { REASON_LABELS } from "@/lib/vacancyActions/validation";
import { buildVacancyHref, type VacancyHrefParams } from "@/lib/vacancyActions/vacancyLinks";
import { columnLabel, COLUMNS_BY_VIEW, nextSortState, type SortableColumnKey } from "@/lib/vacancyActions/vacancySort";
import { VacancyActions } from "./VacancyActions";
import { StarToggle } from "./StarToggle";
import { AutoDraftToggle, PilotToggle } from "./AutomationToggle";

const EMPTY_STATE_TEXT: Record<VacancyTabView, string> = {
  todo: "No vacancies to triage.",
  interest: "No starred vacancies yet.",
  applied: "No applied vacancies yet.",
  all: "No vacancies yet.",
  success: "No successful vacancies yet.",
  rejected: "No rejected vacancies yet.",
  ignored: "No ignored vacancies yet.",
  autodraft: "Nothing queued for auto-draft.",
};

const STATUS_PILL_CLASS: Record<VacancyTabRow["status"], string> = {
  todo: "bg-status-todo-bg text-status-todo-fg",
  applied: "bg-status-applied-bg text-status-applied-fg",
  success: "bg-status-success-bg text-status-success-fg",
  rejected: "bg-status-rejected-bg text-status-rejected-fg",
  ignored: "bg-status-ignored-bg text-status-ignored-fg",
};

// Title, Company and Location are the only columns allowed to wrap — every
// other column (dates, pills, Link, header labels) is forced to one line so
// a narrow viewport can't cause tables to force-wrap short cells instead of
// shrinking the flexible ones.
const WRAP_ALLOWED_MIN_WIDTH: Partial<Record<SortableColumnKey, string>> = {
  title: "min-w-[var(--title-col-min-width)]",
  company: "min-w-[var(--company-col-min-width)]",
  location: "min-w-[var(--location-col-min-width)]",
};

// The classic auto-table-layout trick: an explicit tiny width tells the
// browser "give this column no more than its content needs" (it still can't
// shrink past a min-width floor or past nowrap content's natural width).
// Title is the one column without this class, so it alone receives whatever
// width is left over once every other column has claimed only what it needs.
const SHRINK_TO_CONTENT = "w-[1%]";

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium tracking-wide uppercase ${className}`}
    >
      {children}
    </span>
  );
}

function SortArrow({ dir, faint = false }: { dir: "asc" | "desc"; faint?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      width="10"
      height="10"
      className={`inline-block shrink-0 ${dir === "desc" ? "rotate-180" : ""} ${
        faint ? "text-text-muted opacity-40" : "text-accent"
      }`}
    >
      <path d="M6 2 L10 8 L2 8 Z" fill="currentColor" />
    </svg>
  );
}

function ViewLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border-accent-subtle px-3 py-1 text-accent transition-colors hover:bg-accent-muted-bg"
    >
      View
      <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10" className="shrink-0">
        <path
          d="M3 9 L9 3 M4.5 3 H9 V7.5"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function SortableHeader({
  column,
  hrefParams,
  sort,
  dir,
}: {
  column: SortableColumnKey;
  hrefParams: VacancyHrefParams;
  sort: SortableColumnKey | null;
  dir: "asc" | "desc" | null;
}) {
  const isActive = sort === column;
  const next = nextSortState(column, sort, dir);
  const ariaSort = isActive ? (dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      scope="col"
      className={`py-2 pr-3 font-medium whitespace-nowrap ${WRAP_ALLOWED_MIN_WIDTH[column] ?? ""} ${
        column === "title" ? "" : SHRINK_TO_CONTENT
      } ${isActive ? "text-text-primary" : "text-text-secondary"}`}
      aria-sort={ariaSort}
    >
      <Link
        href={buildVacancyHref({ ...hrefParams, sort: next.sort, dir: next.dir })}
        className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-accent"
      >
        {columnLabel(column)}
        {isActive && dir ? <SortArrow dir={dir} /> : <SortArrow dir="asc" faint />}
      </Link>
    </th>
  );
}

export function VacancyTable({
  view,
  rows,
  hasActiveFilters,
  clearFiltersHref,
  reasonFilter,
  status,
  show,
  q,
  company,
  from,
  to,
  pilot,
  sort,
  dir,
}: VacancyHrefParams & {
  rows: VacancyTabRow[];
  hasActiveFilters: boolean;
  clearFiltersHref: string;
}) {
  if (rows.length === 0) {
    if (hasActiveFilters) {
      return (
        <p className="text-text-secondary">
          No vacancies match.{" "}
          <Link
            href={clearFiltersHref}
            className="rounded-full border border-border-subtle px-3 py-1 text-sm text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
          >
            Clear filters
          </Link>
        </p>
      );
    }
    return <p className="text-text-secondary">{EMPTY_STATE_TEXT[view]}</p>;
  }

  const hrefParams: VacancyHrefParams = { view, reasonFilter, status, show, q, company, from, to, pilot };
  const activeSort = sort ?? null;
  const activeDir = dir ?? null;
  const columns = COLUMNS_BY_VIEW[view];
  const showAppliedOn = view === "applied" || view === "success" || view === "rejected";
  const showOutcomeOn = view === "success" || view === "rejected";
  const showStatusPill = view === "all" || view === "interest";
  const header = (column: SortableColumnKey) => (
    <SortableHeader column={column} hrefParams={hrefParams} sort={activeSort} dir={activeDir} />
  );

  return (
    <div className="overflow-x-auto min-[1100px]:overflow-x-visible">
      <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs">
            <th scope="col" className={`py-2 pr-3 font-medium whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}>
              Star
            </th>
            <th
              scope="col"
              aria-label="Auto-draft"
              title="Auto-draft"
              className={`py-2 pr-3 font-medium whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              >
                <path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" />
              </svg>
            </th>
            {columns.includes("title") && header("title")}
            {columns.includes("company") && header("company")}
            {columns.includes("location") && header("location")}
            {columns.includes("firstSeenAt") && header("firstSeenAt")}
            <th
              scope="col"
              className={`py-2 pr-3 font-medium whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}
            >
              Link
            </th>
            {showAppliedOn && columns.includes("appliedOn") && header("appliedOn")}
            {showOutcomeOn && columns.includes("outcomeOn") && header("outcomeOn")}
            {view === "ignored" && (
              <>
                {columns.includes("ignoredOn") && header("ignoredOn")}
                {columns.includes("ignoreReason") && header("ignoreReason")}
              </>
            )}
            {showStatusPill && columns.includes("status") && header("status")}
            <th
              scope="col"
              className={`py-2 pr-3 font-medium whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const starInteractive = view === "interest" || row.status === "todo";
            return (
              <tr
                key={row.id}
                className={`rounded-md transition-colors hover:bg-surface-row-hover ${
                  row.starred ? "bg-surface-row-starred" : "bg-surface-row"
                }`}
              >
                <td className={`rounded-l-md py-3 pr-3 pl-3 ${SHRINK_TO_CONTENT}`}>
                  <StarToggle vacancyId={row.id} starred={row.starred} interactive={starInteractive} />
                </td>
                <td className={`py-3 pr-3 ${SHRINK_TO_CONTENT}`}>
                  <AutoDraftToggle vacancyId={row.id} marked={row.autoDraft} />
                </td>
                <td className={`py-3 pr-3 text-text-primary ${WRAP_ALLOWED_MIN_WIDTH.title}`}>{row.title}
                  {row.pilot && (
                    <>
                      {" "}
                      <Pill className="bg-tag-bg text-tag-fg">Pilot</Pill>
                    </>
                  )}
                </td>
                <td
                  className={`py-3 pr-3 text-text-secondary ${WRAP_ALLOWED_MIN_WIDTH.company} ${SHRINK_TO_CONTENT}`}
                >
                  {row.company}
                </td>
                <td
                  className={`py-3 pr-3 text-text-secondary ${WRAP_ALLOWED_MIN_WIDTH.location} ${SHRINK_TO_CONTENT}`}
                >
                  {row.location ?? ""}
                </td>
                <td className={`py-3 pr-3 whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}>
                  {formatKlDate(row.firstSeenAt)}
                </td>
                <td className={`py-3 pr-3 whitespace-nowrap ${SHRINK_TO_CONTENT}`}>
                  <ViewLink href={row.url} />
                </td>
                {showAppliedOn && (
                  <td className={`py-3 pr-3 whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}>
                    {row.appliedOn ? formatKlDate(row.appliedOn) : ""}
                  </td>
                )}
                {showOutcomeOn && (
                  <td className={`py-3 pr-3 whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}>
                    {row.outcomeOn ? formatKlDate(row.outcomeOn) : ""}
                  </td>
                )}
                {view === "ignored" && (
                  <>
                    <td className={`py-3 pr-3 whitespace-nowrap text-text-secondary ${SHRINK_TO_CONTENT}`}>
                      {row.ignoredOn ? formatKlDate(row.ignoredOn) : ""}
                    </td>
                    <td className={`py-3 pr-3 whitespace-nowrap ${SHRINK_TO_CONTENT}`}>
                      {row.ignoreReason ? (
                        <Pill className="bg-tag-bg text-tag-fg">{REASON_LABELS[row.ignoreReason]}</Pill>
                      ) : (
                        "-"
                      )}
                    </td>
                  </>
                )}
                {showStatusPill && (
                  <td className={`py-3 pr-3 whitespace-nowrap ${SHRINK_TO_CONTENT}`}>
                    <Pill className={STATUS_PILL_CLASS[row.status]}>{STATUS_LABELS[row.status]}</Pill>
                  </td>
                )}
                <td className={`rounded-r-md py-3 pr-3 whitespace-nowrap ${SHRINK_TO_CONTENT}`}>
                  <div className="flex items-start gap-2">
                    <VacancyActions
                      vacancyId={row.id}
                      status={row.status}
                      appliedOn={row.appliedOn}
                      outcomeOn={row.outcomeOn}
                    />
                    <PilotToggle vacancyId={row.id} marked={row.pilot} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
