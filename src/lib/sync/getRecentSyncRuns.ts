// src/lib/sync/getRecentSyncRuns.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncRunRecord } from "./syncRunRecord";

const RECENT_RUNS_LIMIT = 10;

function isTrigger(value: unknown): value is SyncRunRecord["trigger"] {
  return value === "cron" || value === "manual";
}

function isStatus(value: unknown): value is SyncRunRecord["status"] {
  return value === "ok" || value === "error";
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
    parserFailures: (row.parser_failures as SyncRunRecord["parserFailures"]) ?? [],
    failures: (row.failures as SyncRunRecord["failures"]) ?? [],
    warningDetails: (row.warning_details as SyncRunRecord["warningDetails"]) ?? [],
    error: row.error as string | null,
  };
}

export async function getRecentSyncRuns(): Promise<SyncRunRecord[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select(
      "id, trigger, status, started_at, finished_at, messages, cards, unique_jobs, inserted, skipped, warnings, parser_failure_count, parser_failures, failures, warning_details, error"
    )
    .order("id", { ascending: false })
    .limit(RECENT_RUNS_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const runs: SyncRunRecord[] = [];
  for (const row of data ?? []) {
    try {
      runs.push(mapSyncRunRow(row));
    } catch (mapError) {
      console.error("Skipping unreadable sync_runs row:", mapError);
    }
  }
  return runs;
}
