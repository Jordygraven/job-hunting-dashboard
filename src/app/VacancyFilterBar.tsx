import Link from "next/link";
import type { IgnoreReason } from "@/lib/vacancyActions/types";
import { buildVacancyHref } from "@/lib/vacancyActions/vacancyLinks";
import { STATUS_LABELS, type VacancyStatusFilter, type VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";

const STATUS_OPTIONS: VacancyStatusFilter[] = ["todo", "applied", "ignored"];
const inputClass = "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";

export function VacancyFilterBar({
  view,
  reasonFilter,
  q,
  company,
  from,
  to,
  status,
  companies,
  hasActiveFilters,
}: {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
  status: VacancyStatusFilter | null;
  companies: string[];
  hasActiveFilters: boolean;
}) {
  return (
    <form method="get" action="/" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="view" value={view} />
      {reasonFilter && <input type="hidden" name="reason" value={reasonFilter} />}

      <label className="flex flex-col gap-1">
        Search
        <input type="text" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        Company
        <select name="company" defaultValue={company ?? ""} className={inputClass}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        From
        <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        To
        <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
      </label>

      {view === "all" && (
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
        Search
      </button>

      {hasActiveFilters && (
        <Link href={buildVacancyHref({ view, reasonFilter })} className="underline">
          Clear filters
        </Link>
      )}
    </form>
  );
}
