import Link from "next/link";
import { describeShownRows, type ShowParam } from "@/lib/vacancyActions/vacancyTabs";
import { buildVacancyHref, type VacancyHrefParams } from "@/lib/vacancyActions/vacancyLinks";

export function VacancyPagination({
  view,
  reasonFilter,
  status,
  show,
  filteredCount,
  q,
  company,
  from,
  to,
  pilot,
  sort,
  dir,
}: VacancyHrefParams & { filteredCount: number; show: ShowParam }) {
  const summary = describeShownRows(filteredCount, show);
  if (!summary) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2 text-sm text-text-secondary">
      <p>
        Showing {summary.shown} of {summary.total}
      </p>
      {summary.more && (
        <Link
          href={buildVacancyHref({
            view,
            reasonFilter,
            status,
            show: summary.more.show === "all" ? "all" : 20,
            q,
            company,
            from,
            to,
            pilot,
            sort,
            dir,
          })}
          className="rounded-full border border-border-subtle px-4 py-1.5 text-text-secondary transition-colors hover:border-accent hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {summary.more.label}
        </Link>
      )}
    </div>
  );
}
