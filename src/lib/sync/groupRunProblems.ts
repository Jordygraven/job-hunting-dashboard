import type { ResolvedSyncRunDetail, SyncRunRecord, SyncSource } from "./syncRunRecord";

export interface SourceProblems {
  source: SyncSource;
  board?: string;
  failures: ResolvedSyncRunDetail[];
  parserFailures: ResolvedSyncRunDetail[];
  warnings: ResolvedSyncRunDetail[];
}

export interface RunProblems {
  topLevel: string[];
  bySource: SourceProblems[];
}

// Parser failures and card warnings only come from LinkedIn, so they group by the source their entries carry.
export function groupRunProblems(run: SyncRunRecord): RunProblems {
  const groups = new Map<string, SourceProblems>();

  function groupFor(detail: ResolvedSyncRunDetail): SourceProblems {
    const key = `${detail.source}|${detail.board ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = { source: detail.source, board: detail.board, failures: [], parserFailures: [], warnings: [] };
      groups.set(key, group);
    }
    return group;
  }

  for (const d of run.failures) groupFor(d).failures.push(d);
  for (const d of run.parserFailures) groupFor(d).parserFailures.push(d);
  for (const d of run.warningDetails) groupFor(d).warnings.push(d);

  const bySource = [...groups.values()].sort(
    (a, b) => Number(a.source !== "linkedin") - Number(b.source !== "linkedin")
  );
  const topLevel = (run.error ?? "").split("\n").filter((line) => line.trim() !== "");
  return { topLevel, bySource };
}
