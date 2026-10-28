// src/app/page.tsx
import {
  getVacancyTabData,
  type VacancyTabSearchParams,
} from "@/lib/vacancyActions/getVacancyTabData";
import { getRecentSyncRuns } from "@/lib/sync/getRecentSyncRuns";
import { getSyncAlert } from "@/lib/sync/getSyncAlert";
import Link from "next/link";
import { pluralize } from "@/lib/format/pluralize";
import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { buildVacancyHref } from "@/lib/vacancyActions/vacancyLinks";
import { SyncButton } from "./SyncButton";
import { VacancyFilterBar } from "./VacancyFilterBar";
import { VacancyTabs } from "./VacancyTabs";
import { VacancyTable } from "./VacancyTable";
import { VacancyPagination } from "./VacancyPagination";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<VacancyTabSearchParams>;
}) {
  const params = await searchParams;
  const [
    {
      view,
      reasonFilter,
      statusFilter,
      counts,
      rows,
      show,
      filteredCount,
      q,
      company,
      from,
      to,
      pilot,
      companies,
      hasActiveFilters,
      sort,
      dir,
    },
    recentRuns,
  ] = await Promise.all([getVacancyTabData(params), getRecentSyncRuns()]);
  const latestRun = recentRuns[0] ?? null;
  const alerts = getSyncAlert(latestRun, new Date());
  const clearFiltersHref = buildVacancyHref({ view, reasonFilter, sort, dir });

  return (
    <div className="flex flex-col flex-1 bg-surface-page font-sans">
      <main className="flex flex-1 w-full max-w-content mx-auto flex-col py-12 px-6 gap-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-text-primary">Vacancies</h1>
          <Link
            href="/syncs"
            className="whitespace-nowrap rounded-full border border-border-control bg-surface-control px-3 py-1 text-sm text-text-primary transition-colors hover:border-border-control-hover hover:bg-surface-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            View syncs
          </Link>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3 text-text-primary">Sync status</h2>

          <div className="mb-3">
            <SyncButton />
          </div>

          {alerts.length > 0 && (
            <Link
              href="/syncs"
              className="mb-3 block rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg"
            >
              Sync needs attention ({alerts.length}). See Syncs.
            </Link>
          )}

          {latestRun && latestRun.status === "error" && (
            <p className="text-sm text-text-secondary">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) · sync
              failed, <Link href="/syncs" className="text-accent">see Syncs</Link>.
            </p>
          )}

          {latestRun && latestRun.status === "ok" && (
            <p className="text-sm text-text-secondary">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) ·{" "}
              {latestRun.messages ?? 0} messages, {latestRun.cards ?? 0} cards,{" "}
              {latestRun.inserted ?? 0} inserted, {latestRun.skipped ?? 0} skipped,{" "}
              {pluralize(latestRun.warnings ?? 0, "warning")}.
            </p>
          )}
        </section>

        <section>
          <VacancyFilterBar
            view={view}
            reasonFilter={reasonFilter}
            q={q}
            company={company}
            from={from}
            to={to}
            pilot={pilot}
            status={statusFilter}
            companies={companies}
            hasActiveFilters={hasActiveFilters}
            sort={sort}
            dir={dir}
          />
          <VacancyTabs
            view={view}
            counts={counts}
            reasonFilter={reasonFilter}
            status={statusFilter}
            show={show}
            q={q}
            company={company}
            from={from}
            to={to}
            pilot={pilot}
            sort={sort}
            dir={dir}
          />
          <VacancyTable
            view={view}
            rows={rows}
            hasActiveFilters={hasActiveFilters}
            clearFiltersHref={clearFiltersHref}
            reasonFilter={reasonFilter}
            status={statusFilter}
            show={show}
            q={q}
            company={company}
            from={from}
            to={to}
            pilot={pilot}
            sort={sort}
            dir={dir}
          />
          <VacancyPagination
            view={view}
            reasonFilter={reasonFilter}
            status={statusFilter}
            show={show}
            filteredCount={filteredCount}
            q={q}
            company={company}
            from={from}
            to={to}
            pilot={pilot}
            sort={sort}
            dir={dir}
          />
        </section>
      </main>
    </div>
  );
}
