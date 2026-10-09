import Link from "next/link";
import type { VacancyTabCounts, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";
import { IGNORE_REASONS, REASON_LABELS } from "@/lib/vacancyActions/validation";
import { buildVacancyHref, type VacancyHrefParams } from "@/lib/vacancyActions/vacancyLinks";

const TABS: { view: VacancyTabView; label: string }[] = [
  { view: "todo", label: "To do" },
  { view: "interest", label: "Interest" },
  { view: "applied", label: "Applied" },
  { view: "all", label: "All" },
  { view: "success", label: "Success" },
  { view: "rejected", label: "Rejected" },
  { view: "ignored", label: "Ignored" },
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
  sort,
  dir,
}: VacancyHrefParams & { counts: VacancyTabCounts }) {
  return (
    <>
      <nav aria-label="Vacancy tabs" className="mb-6 flex gap-6 border-b border-border-subtle">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={buildVacancyHref({ view: tab.view, status, show, q, company, from, to, sort, dir })}
            aria-current={view === tab.view ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
              view === tab.view
                ? "border-accent font-semibold text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label} <span className="text-text-muted">({counts[tab.view]})</span>
          </Link>
        ))}
      </nav>

      {view === "ignored" && (
        <nav aria-label="Ignore reason filter" className="mb-4 flex gap-4 text-sm">
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
                sort,
                dir,
              })}
              aria-current={reasonFilter === filter.value ? "page" : undefined}
              className={
                reasonFilter === filter.value
                  ? "font-semibold text-accent"
                  : "text-text-secondary hover:text-text-primary"
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
