// src/lib/sync/getLatestSyncRun.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SyncRunRecord } from "./syncRunRecord";

export async function getLatestSyncRun(): Promise<SyncRunRecord | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select(
      "trigger, status, started_at, finished_at, messages, cards, unique_jobs, inserted, skipped, warnings, parser_failure_count, parser_failures, failures, warning_details, error"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    trigger: data.trigger,
    status: data.status,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    messages: data.messages,
    cards: data.cards,
    uniqueJobs: data.unique_jobs,
    inserted: data.inserted,
    skipped: data.skipped,
    warnings: data.warnings,
    parserFailureCount: data.parser_failure_count,
    parserFailures: data.parser_failures ?? [],
    failures: data.failures ?? [],
    warningDetails: data.warning_details ?? [],
    error: data.error,
  };
}
