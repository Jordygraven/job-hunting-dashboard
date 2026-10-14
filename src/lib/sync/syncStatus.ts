import type { SyncRunRecord } from "./syncRunRecord";

export type SyncStatus = "ok" | "warning" | "error";

export function getSyncStatus(run: SyncRunRecord): SyncStatus {
  if (run.status === "error") return "error";
  const hasProblems =
    run.failures.length > 0 ||
    (run.warnings ?? 0) > 0 ||
    (run.parserFailureCount ?? 0) > 0 ||
    run.parserFailures.length > 0 ||
    run.warningDetails.length > 0;
  return hasProblems ? "warning" : "ok";
}
