// src/lib/sync/getSyncAlert.ts
import type { SyncRunDetail, SyncRunRecord } from "./syncRunRecord";

const STALE_THRESHOLD_HOURS = 26;

export type AlertReason =
  | { type: "no-run" }
  | { type: "stale"; finishedAt: string }
  | { type: "error"; error: string }
  | { type: "failures"; failures: SyncRunDetail[] }
  | { type: "parser-failures"; count: number; parserFailures: SyncRunDetail[] };

export function getSyncAlert(latestRun: SyncRunRecord | null, now: Date): AlertReason[] {
  if (!latestRun) {
    return [{ type: "no-run" }];
  }

  const reasons: AlertReason[] = [];

  const ageHours =
    (now.getTime() - new Date(latestRun.finishedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours > STALE_THRESHOLD_HOURS) {
    reasons.push({ type: "stale", finishedAt: latestRun.finishedAt });
  }

  if (latestRun.status === "error") {
    reasons.push({ type: "error", error: latestRun.error ?? "unknown error" });
  }

  if (latestRun.failures.length > 0) {
    reasons.push({ type: "failures", failures: latestRun.failures });
  }

  if ((latestRun.parserFailureCount ?? 0) > 0) {
    reasons.push({
      type: "parser-failures",
      count: latestRun.parserFailureCount ?? 0,
      parserFailures: latestRun.parserFailures,
    });
  }

  return reasons;
}
