// src/app/page.tsx
import {
  getVacancyTabData,
  type VacancyTabSearchParams,
} from "@/lib/vacancyActions/getVacancyTabData";
import { getRecentSyncRuns } from "@/lib/sync/getRecentSyncRuns";
import { getSyncAlert, STALE_THRESHOLD_HOURS, type AlertReason } from "@/lib/sync/getSyncAlert";
import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { buildVacancyHref } from "@/lib/vacancyActions/vacancyLinks";
import { SyncButton } from "./SyncButton";
import { SyncDetails, pluralize } from "./SyncDetails";
import { VacancyFilterBar } from "./VacancyFilterBar";
import { VacancyTabs } from "./VacancyTabs";
import { VacancyTable } from "./VacancyTable";
import { VacancyPagination } from "./VacancyPagination";

export const dynamic = "force-dynamic";

function alertText(reason: AlertReason): string {
  switch (reason.type) {
    case "no-run":
      return "No sync has ever run.";
    case "stale":
      return `Last sync finished at ${formatKlDateTime(reason.finishedAt)}, more than ${STALE_THRESHOLD_HOURS} hours ago.`;
    case "error":
      return `Last sync failed: ${reason.error}`;
    case "failures":
      return `${reason.failures.length} message(s) failed: ${reason.failures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
    case "parser-failures":
      return `${reason.count} card(s) failed to parse: ${reason.parserFailures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
  }
}

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
        <h1 className="text-2xl font-semibold text-text-primary">Vacancies</h1>

        <section>
          <h2 className="text-lg font-semibold mb-3 text-text-primary">Sync status</h2>

          <div className="mb-3">
            <SyncButton />
          </div>

          {alerts.length > 0 && (
            <div className="mb-3 rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
              <ul className="list-disc pl-4">
                {alerts.map((reason) => (
                  <li key={reason.type}>{alertText(reason)}</li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && latestRun.status === "error" && (
            <p className="text-sm text-text-secondary">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) · sync
              failed, see above.
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

          <SyncDetails recentRuns={recentRuns} defaultOpen={alerts.length > 0} />
        </section>

        <section>
          <VacancyFilterBar
            view={view}
            reasonFilter={reasonFilter}
            q={q}
            company={company}
            from={from}
            to={to}
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
            sort={sort}
            dir={dir}
          />
        </section>
      </main>
    </div>
  );
}
