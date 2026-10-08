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
}: VacancyHrefParams & { filteredCount: number; show: ShowParam }) {
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
