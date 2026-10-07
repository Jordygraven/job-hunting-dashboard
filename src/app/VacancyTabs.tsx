import Link from "next/link";
import type { ShowParam, VacancyTabCounts, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

const TABS: { view: VacancyTabView; label: string }[] = [
  { view: "todo", label: "To do" },
  { view: "applied", label: "Applied" },
  { view: "ignored", label: "Ignored" },
  { view: "all", label: "All" },
];

const REASON_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All reasons" },
  { value: "language", label: "Language" },
  { value: "location", label: "Location" },
  { value: "seniority", label: "Seniority" },
  { value: "other", label: "Other" },
  { value: "none", label: "No reason" },
];

function showQuery(show: ShowParam): string | null {
  return show === 10 ? null : String(show);
}

function tabHref(view: VacancyTabView, show: ShowParam): string {
  const params = new URLSearchParams({ view });
  const showValue = showQuery(show);
  if (showValue) {
    params.set("show", showValue);
  }
  return `/?${params.toString()}`;
}

function reasonHref(reasonValue: string | null, show: ShowParam): string {
  const params = new URLSearchParams({ view: "ignored" });
  if (reasonValue) {
    params.set("reason", reasonValue);
  }
  const showValue = showQuery(show);
  if (showValue) {
    params.set("show", showValue);
  }
  return `/?${params.toString()}`;
}

export function VacancyTabs({
  view,
  counts,
  reasonFilter,
  show,
}: {
  view: VacancyTabView;
  counts: VacancyTabCounts;
  reasonFilter: IgnoreReason | "none" | null;
  show: ShowParam;
}) {
  return (
    <>
      <nav aria-label="Vacancy tabs" className="mb-4 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={tabHref(tab.view, show)}
            aria-current={view === tab.view ? "page" : undefined}
            className={`pb-2 text-sm ${
              view === tab.view
                ? "border-b-2 border-black font-semibold text-black dark:border-white dark:text-white"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {tab.label} ({counts[tab.view]})
          </Link>
        ))}
      </nav>

      {view === "ignored" && (
        <nav aria-label="Ignore reason filter" className="mb-4 flex gap-3 text-sm">
          {REASON_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={reasonHref(filter.value, show)}
              aria-current={reasonFilter === filter.value ? "page" : undefined}
              className={
                reasonFilter === filter.value
                  ? "font-semibold text-black dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400"
              }
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
