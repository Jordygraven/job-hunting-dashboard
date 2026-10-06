// src/app/page.tsx
import {
  getVacancyTabData,
  type VacancyTabSearchParams,
} from "@/lib/vacancyActions/getVacancyTabData";
import { getLatestSyncRun } from "@/lib/sync/getLatestSyncRun";
import { getSyncAlert, type AlertReason } from "@/lib/sync/getSyncAlert";
import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { SyncButton } from "./SyncButton";
import { VacancyTabs } from "./VacancyTabs";
import { VacancyTable } from "./VacancyTable";

export const dynamic = "force-dynamic";

function alertText(reason: AlertReason): string {
  switch (reason.type) {
    case "no-run":
      return "No sync has ever run.";
    case "stale":
      return `Last sync finished at ${formatKlDateTime(reason.finishedAt)}, more than 26 hours ago.`;
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
  const [{ view, reasonFilter, counts, rows }, latestRun] = await Promise.all([
    getVacancyTabData(params),
    getLatestSyncRun(),
  ]);
  const alerts = getSyncAlert(latestRun, new Date());

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6 gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Vacancies</h1>

        <section>
          <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
            Sync status
          </h2>

          <div className="mb-3">
            <SyncButton />
          </div>

          {alerts.length > 0 && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <ul className="list-disc pl-4">
                {alerts.map((reason) => (
                  <li key={reason.type}>{alertText(reason)}</li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && latestRun.status === "error" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) — sync
              failed, see above.
            </p>
          )}

          {latestRun && latestRun.status === "ok" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) —{" "}
              {latestRun.messages ?? 0} messages, {latestRun.cards ?? 0} cards,{" "}
              {latestRun.inserted ?? 0} inserted, {latestRun.skipped ?? 0} skipped,{" "}
              {latestRun.warnings ?? 0} warnings.
            </p>
          )}
        </section>

        <section>
          <VacancyTabs view={view} counts={counts} reasonFilter={reasonFilter} />
          <VacancyTable view={view} rows={rows} />
        </section>
      </main>
    </div>
  );
}
