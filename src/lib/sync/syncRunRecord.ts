// src/lib/sync/syncRunRecord.ts
export type SyncSource = "linkedin" | "greenhouse";

// Stored shape. Rows written before epic 11 have no source or board.
export interface SyncRunDetail {
  messageId: string;
  jobId: string | null;
  reason: string;
  source?: SyncSource;
  board?: string;
}

// Read side: the mapper always fills source.
export type ResolvedSyncRunDetail = SyncRunDetail & { source: SyncSource };

export interface SourceResult {
  source: SyncSource;
  board?: string;
  found: number;
  inserted: number;
  skipped: number;
  failed: number;
  // set only when the board was not fetched
  reason?: "not_due" | "dead";
}

export interface SyncRunRecord {
  id: number;
  runId: string | null;
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
  sourceResults: SourceResult[] | null;
  parserFailures: ResolvedSyncRunDetail[];
  failures: ResolvedSyncRunDetail[];
  warningDetails: ResolvedSyncRunDetail[];
  error: string | null;
}
