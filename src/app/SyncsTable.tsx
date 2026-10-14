import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { getSyncStatus } from "@/lib/sync/syncStatus";
import { groupRunProblems, type SourceProblems } from "@/lib/sync/groupRunProblems";
import { LIST_NOT_AVAILABLE, type SourceGroup } from "@/lib/sync/getSyncVacancies";
import type { SourceResult, SyncRunRecord } from "@/lib/sync/syncRunRecord";
import { SyncBadge } from "./SyncBadge";

type Vacancies = Map<number, SourceGroup[] | typeof LIST_NOT_AVAILABLE>;

function sourceName(source: SourceResult["source"]): string {
  return source === "linkedin" ? "LinkedIn" : "Greenhouse";
}

function ProblemList({ problems }: { problems: SourceProblems | undefined }) {
  if (!problems) return null;
  const reasons = [...problems.failures, ...problems.parserFailures, ...problems.warnings].map(
    (d) => d.reason
  );
  if (reasons.length === 0) return null;
  return (
    <ul className="mt-1 list-disc pl-4 text-xs text-text-muted">
      {reasons.map((reason, i) => (
        <li key={i}>{reason}</li>
      ))}
    </ul>
  );
}

function SourceBlock({
  heading,
  result,
  group,
  problems,
}: {
  heading: string;
  result: SourceResult | undefined;
  group: SourceGroup | undefined;
  problems: SourceProblems | undefined;
}) {
  return (
    <div className="mt-3 pl-4">
      <p className="text-xs font-semibold text-text-secondary">{heading}</p>
      {group?.lines === null ? (
        <p className="text-xs text-text-muted">{group.inserted} new</p>
      ) : (
        result && (
          <p className="text-xs text-text-muted">
            found {result.found} · inserted {result.inserted} · skipped {result.skipped} · failed{" "}
            {result.failed}
          </p>
        )
      )}
      <ProblemList problems={problems} />
      {group?.lines && (
        <ul className="mt-1 pl-4 text-xs text-text-muted">
          {group.lines.map((line, i) => (
            <li key={i}>
              {line.title} · {line.company} ·{" "}
              <a href={line.url} target="_blank" rel="noreferrer" className="text-accent">
                Open
              </a>
            </li>
          ))}
          {group.more > 0 && <li>and {group.more} more</li>}
        </ul>
      )}
    </div>
  );
}

function SyncRow({
  run,
  groups,
  open,
}: {
  run: SyncRunRecord;
  groups: SourceGroup[] | typeof LIST_NOT_AVAILABLE | undefined;
  open: boolean;
}) {
  const { topLevel, bySource } = groupRunProblems(run);
  const list = groups === undefined || groups === LIST_NOT_AVAILABLE ? null : groups;
  const matches = (p: SourceProblems, e: SourceResult | undefined) =>
    e !== undefined && p.source === e.source && p.board === e.board;
  // Problems whose source has no block (old runs, unknown boards) get their own block.
  const orphans = bySource.filter(
    (p) => !run.sourceResults?.some((e) => matches(p, e)) || list === null
  );

  return (
    <details open={open} className="group border-t border-border-subtle px-4 py-3 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-sm text-text-secondary [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ›
        </span>
        <span>{formatKlDateTime(run.finishedAt)}</span>
        <span>{run.trigger}</span>
        <SyncBadge status={getSyncStatus(run)} />
        <span>{run.inserted ?? 0} new</span>
      </summary>

      {topLevel.length > 0 && (
        <ul className="mt-3 list-disc rounded-lg border border-danger-border bg-danger-bg p-3 pl-7 text-sm text-danger-fg">
          {topLevel.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      {list?.map((group, i) => {
        const result = run.sourceResults?.[i];
        const heading =
          group.source === "linkedin" ? "LinkedIn" : `Greenhouse · ${group.label}`;
        return (
          <SourceBlock
            key={i}
            heading={heading}
            result={result}
            group={group}
            problems={bySource.find((p) => matches(p, result))}
          />
        );
      })}

      {orphans.map((p, i) => (
        <SourceBlock
          key={`o${i}`}
          heading={p.board ? `${sourceName(p.source)} · ${p.board}` : sourceName(p.source)}
          result={undefined}
          group={undefined}
          problems={p}
        />
      ))}

      {list === null && (
        <p className="mt-3 pl-4 text-xs text-text-muted">— vacancy list not available</p>
      )}
    </details>
  );
}

export function SyncsTable({
  runs,
  vacancies,
  openFirst,
}: {
  runs: SyncRunRecord[];
  vacancies: Vacancies;
  openFirst: boolean;
}) {
  if (runs.length === 0) return <p className="text-sm text-text-muted">No syncs yet.</p>;
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-panel">
      {runs.map((run, index) => (
        <SyncRow key={run.id} run={run} groups={vacancies.get(run.id)} open={openFirst && index === 0} />
      ))}
    </div>
  );
}
