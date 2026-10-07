import Link from "next/link";
import { describeShownRows, type ShowParam, type VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

function moreHref(
  view: VacancyTabView,
  reasonFilter: IgnoreReason | "none" | null,
  show: "20" | "all"
): string {
  const params = new URLSearchParams({ view });
  if (reasonFilter) {
    params.set("reason", reasonFilter);
  }
  params.set("show", show);
  return `/?${params.toString()}`;
}

export function VacancyPagination({
  view,
  reasonFilter,
  show,
  filteredCount,
}: {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  show: ShowParam;
  filteredCount: number;
}) {
  const summary = describeShownRows(filteredCount, show);
  if (!summary) {
    return null;
  }

  return (
    <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
      <p>
        Showing {summary.shown} of {summary.total}
      </p>
      {summary.more && (
        <Link href={moreHref(view, reasonFilter, summary.more.show)} className="underline">
          {summary.more.label}
        </Link>
      )}
    </div>
  );
}
