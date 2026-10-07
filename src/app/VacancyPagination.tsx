import Link from "next/link";
import { describeShownRows, type ShowParam, type VacancyStatusFilter, type VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";
import { buildVacancyHref } from "@/lib/vacancyActions/vacancyLinks";

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
}: {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  status: VacancyStatusFilter | null;
  show: ShowParam;
  filteredCount: number;
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
}) {
  const summary = describeShownRows(filteredCount, show);
  if (!summary) {
    return null;
  }

  return (
    <div className="mt-3 w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
      <p className="w-full text-left">
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
          })}
          className="block w-fit text-left underline"
        >
          {summary.more.label}
        </Link>
      )}
    </div>
  );
}
