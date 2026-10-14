// src/lib/sync/getRecentSyncRuns.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ResolvedSyncRunDetail,
  SourceResult,
  SyncRunDetail,
  SyncRunRecord,
} from "./syncRunRecord";

const RECENT_RUNS_LIMIT = 10;

function isTrigger(value: unknown): value is SyncRunRecord["trigger"] {
  return value === "cron" || value === "manual";
}

function isStatus(value: unknown): value is SyncRunRecord["status"] {
  return value === "ok" || value === "error";
}

export const SYNC_RUN_COLUMNS =
  "id, run_id, trigger, status, started_at, finished_at, messages, cards, unique_jobs, inserted, skipped, warnings, parser_failure_count, source_results, parser_failures, failures, warning_details, error";

const GREENHOUSE_PREFIX = "greenhouse:";

function resolveDetail(detail: SyncRunDetail): ResolvedSyncRunDetail {
  const stored = detail.source === "linkedin" || detail.source === "greenhouse" ? detail.source : null;
  const legacyGreenhouse = detail.messageId.startsWith(GREENHOUSE_PREFIX);
  const source = stored ?? (legacyGreenhouse ? "greenhouse" : "linkedin");
  const board =
    detail.board ?? (!stored && legacyGreenhouse ? detail.messageId.slice(GREENHOUSE_PREFIX.length) : undefined);
  return board === undefined ? { ...detail, source } : { ...detail, source, board };
}

function resolveDetails(value: unknown): ResolvedSyncRunDetail[] {
  return ((value as SyncRunDetail[] | null) ?? []).map(resolveDetail);
}

export function mapSyncRunRow(row: Record<string, unknown>): SyncRunRecord {
  if (!isTrigger(row.trigger)) {
    throw new Error(`sync_runs row ${String(row.id)} has an unexpected trigger: ${String(row.trigger)}`);
  }
  if (!isStatus(row.status)) {
    throw new Error(`sync_runs row ${String(row.id)} has an unexpected status: ${String(row.status)}`);
  }

  return {
    id: row.id as number,
    runId: (row.run_id as string | null | undefined) ?? null,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    messages: row.messages as number | null,
    cards: row.cards as number | null,
    uniqueJobs: row.unique_jobs as number | null,
    inserted: row.inserted as number | null,
    skipped: row.skipped as number | null,
    warnings: row.warnings as number | null,
    parserFailureCount: row.parser_failure_count as number | null,
    sourceResults: (row.source_results as SourceResult[] | null | undefined) ?? null,
    parserFailures: resolveDetails(row.parser_failures),
    failures: resolveDetails(row.failures),
    warningDetails: resolveDetails(row.warning_details),
    error: row.error as string | null,
  };
}

export async function getRecentSyncRuns(): Promise<SyncRunRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select(SYNC_RUN_COLUMNS)
    .order("id", { ascending: false })
    .limit(RECENT_RUNS_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return mapSyncRunRows(data ?? []);
}

export function mapSyncRunRows(rows: Record<string, unknown>[]): SyncRunRecord[] {
  const runs: SyncRunRecord[] = [];
  for (const row of rows) {
    try {
      runs.push(mapSyncRunRow(row));
    } catch (mapError) {
      console.error("Skipping unreadable sync_runs row:", mapError);
    }
  }
  return runs;
}
