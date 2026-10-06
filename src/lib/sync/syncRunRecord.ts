// src/lib/sync/syncRunRecord.ts
export interface SyncRunFailure {
  messageId: string;
  reason: string;
}

export interface SyncRunRecord {
  trigger: "cron" | "manual";
  status: "ok" | "error";
  startedAt: string;
  finishedAt: string;
  messages: number | null;
  cards: number | null;
  uniqueJobs: number | null;
  inserted: number | null;
  skipped: number | null;
  warnings: number | null;
  parserFailureCount: number | null;
  parserFailures: SyncRunFailure[];
  failures: SyncRunFailure[];
  error: string | null;
}
