// src/app/SyncDetails.tsx
import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import type { SyncRunDetail, SyncRunRecord } from "@/lib/sync/syncRunRecord";

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function DetailList({ title, items }: { title: string; items: SyncRunDetail[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
      <ul className="list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
        {items.map((item, index) => (
          <li key={index}>
            {item.messageId} · {item.jobId ?? "—"} · {item.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SyncRunRow({ run, open }: { run: SyncRunRecord; open: boolean }) {
  return (
    <details
      open={open}
      className="border-t border-zinc-200 py-2 first:border-t-0 dark:border-zinc-800"
    >
      <summary className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
        {formatKlDateTime(run.finishedAt)} ({run.trigger}) — {run.status} —{" "}
        {run.inserted ?? 0} inserted — {run.skipped ?? 0} skipped —{" "}
        {pluralize(run.warnings ?? 0, "warning")} —{" "}
        {pluralize(run.parserFailureCount ?? 0, "parser failure")} —{" "}
        {pluralize(run.failures.length, "failure")}
      </summary>
      <DetailList title="Failures" items={run.failures} />
      <DetailList title="Parser failures" items={run.parserFailures} />
      <DetailList title="Warnings" items={run.warningDetails} />
    </details>
  );
}

export function SyncDetails({
  recentRuns,
  defaultOpen,
}: {
  recentRuns: SyncRunRecord[];
  defaultOpen: boolean;
}) {
  if (recentRuns.length === 0) return null;

  return (
    <details open={defaultOpen} className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-black dark:text-zinc-50">
        Details
      </summary>
      <div className="mt-2">
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Recent syncs</h3>
        <div className="mt-1">
          {recentRuns.map((run, index) => (
            <SyncRunRow key={run.id} run={run} open={defaultOpen && index === 0} />
          ))}
        </div>
      </div>
    </details>
  );
}
