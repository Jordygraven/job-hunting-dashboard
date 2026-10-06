// src/app/page.tsx
import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getLatestSyncRun } from "@/lib/sync/getLatestSyncRun";
import { getSyncAlert, type AlertReason } from "@/lib/sync/getSyncAlert";
import { formatKlDate, formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { SyncButton } from "./SyncButton";

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

export default async function Home() {
  const [vacancies, latestRun] = await Promise.all([getVacancies(), getLatestSyncRun()]);
  const alerts = getSyncAlert(latestRun, new Date());

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6 gap-8">
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
                {alerts.map((reason, index) => (
                  <li key={index}>{alertText(reason)}</li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) —{" "}
              {latestRun.messages ?? 0} messages, {latestRun.cards ?? 0} cards,{" "}
              {latestRun.inserted ?? 0} inserted, {latestRun.skipped ?? 0} skipped,{" "}
              {latestRun.warnings ?? 0} warnings.
            </p>
          )}
        </section>

        <section>
          <h1 className="text-2xl font-semibold mb-6 text-black dark:text-zinc-50">
            Vacancies
          </h1>

          {vacancies.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">No vacancies yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">First seen</th>
                  <th className="py-2 pr-4">Link</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((vacancy) => (
                  <tr key={vacancy.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{vacancy.title}</td>
                    <td className="py-2 pr-4">{vacancy.company}</td>
                    <td className="py-2 pr-4">{vacancy.location ?? ""}</td>
                    <td className="py-2 pr-4">{formatKlDate(vacancy.firstSeenAt)}</td>
                    <td className="py-2 pr-4">
                      <a
                        href={vacancy.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
