import Link from "next/link";
import type { VacancyTabCounts, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";
import { IGNORE_REASONS, REASON_LABELS } from "@/lib/vacancyActions/validation";
import { buildVacancyHref, type VacancyHrefParams } from "@/lib/vacancyActions/vacancyLinks";

const TABS: { view: VacancyTabView; label: string }[] = [
  { view: "todo", label: "To do" },
  { view: "applied", label: "Applied" },
  { view: "ignored", label: "Ignored" },
  { view: "all", label: "All" },
];

const REASON_FILTERS: { value: IgnoreReason | "none" | null; label: string }[] = [
  { value: null, label: "All reasons" },
  ...IGNORE_REASONS.map((reason) => ({ value: reason, label: REASON_LABELS[reason] })),
  { value: "none" as const, label: "No reason" },
];

export function VacancyTabs({
  view,
  counts,
  reasonFilter,
  status,
  show,
  q,
  company,
  from,
  to,
}: VacancyHrefParams & { counts: VacancyTabCounts }) {
  return (
    <>
      <nav aria-label="Vacancy tabs" className="mb-4 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={buildVacancyHref({ view: tab.view, status, show, q, company, from, to })}
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
              href={buildVacancyHref({
                view: "ignored",
                reasonFilter: filter.value,
                show,
                q,
                company,
                from,
                to,
              })}
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
