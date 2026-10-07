// src/lib/sync/syncRunRecord.ts
export interface SyncRunDetail {
  messageId: string;
  jobId: string | null;
  reason: string;
}

export interface SyncRunRecord {
  id: number;
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
  parserFailures: SyncRunDetail[];
  failures: SyncRunDetail[];
  warningDetails: SyncRunDetail[];
  error: string | null;
}
