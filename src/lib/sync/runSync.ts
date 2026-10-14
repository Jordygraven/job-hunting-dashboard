import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";
import { fetchMessageContent } from "@/lib/gmail/fetchMessageContent";
import { parseLinkedInAlert } from "@/lib/parsers/linkedin";
import { toVacancyRows, uniqueVacancyRows, type VacancyRow } from "@/lib/sync/vacancyRows";
import { toParserFailures } from "@/lib/sync/parserFailures";
import { toSyncWarnings } from "@/lib/sync/syncWarnings";
import type { SyncRunDetail } from "@/lib/sync/syncRunRecord";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GREENHOUSE_BOARDS } from "@/config/greenhouseBoards";
import { fetchBoardJobs } from "@/lib/greenhouse/fetchBoard";
import { processBoard } from "@/lib/greenhouse/processBoard";

export type SyncTrigger = "cron" | "manual";

export interface SyncResult {
  messages: number;
  cards: number;
  unique: number;
  inserted: number;
  skipped: number;
  warnings: number;
  parserFailureCount: number;
  parserFailures: SyncRunDetail[];
  failures: SyncRunDetail[];
  warningDetails: SyncRunDetail[];
}

export class SyncDatabaseError extends Error {}

function hasMessage(error: unknown): error is { message: unknown } {
  return typeof error === "object" && error !== null && "message" in error;
}

function reasonFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (hasMessage(error)) {
    return typeof error.message === "string" ? error.message : "unknown error";
  }
  return "unknown error";
}

async function recordSyncRun(args: {
  trigger: SyncTrigger;
  startedAt: Date;
  finishedAt: Date;
  status: "ok" | "error";
  counts: {
    messages: number;
    cards: number;
    uniqueJobs: number;
    inserted: number;
    skipped: number;
    warnings: number;
    parserFailureCount: number;
  } | null;
  parserFailures: SyncRunDetail[];
  failures: SyncRunDetail[];
  warningDetails: SyncRunDetail[];
  error: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("sync_runs").insert({
      trigger: args.trigger,
      status: args.status,
      started_at: args.startedAt.toISOString(),
      finished_at: args.finishedAt.toISOString(),
      messages: args.counts?.messages ?? null,
      cards: args.counts?.cards ?? null,
      unique_jobs: args.counts?.uniqueJobs ?? null,
      inserted: args.counts?.inserted ?? null,
      skipped: args.counts?.skipped ?? null,
      warnings: args.counts?.warnings ?? null,
      parser_failure_count: args.counts?.parserFailureCount ?? null,
      parser_failures: args.parserFailures,
      failures: args.failures,
      warning_details: args.warningDetails,
      error: args.error,
    });

    if (error) {
      console.error("Failed to record sync_runs row:", error.message);
    }
  } catch (error) {
    console.error("Failed to record sync_runs row:", reasonFor(error));
  }
}

interface Counts {
  messages: number;
  cards: number;
  unique: number;
  inserted: number;
  skipped: number;
}

async function upsertRows(rows: VacancyRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancies")
    .upsert(rows, { onConflict: "source,source_job_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    throw new SyncDatabaseError(reasonFor(error));
  }
  return data?.length ?? 0;
}

async function syncGmail(
  counts: Counts,
  failures: SyncRunDetail[],
  parserFailures: SyncRunDetail[],
  warningDetails: SyncRunDetail[]
): Promise<void> {
  const alerts = await fetchLinkedInAlerts();

  const fetched = await Promise.allSettled(
    alerts.map((alert) => fetchMessageContent(alert.id))
  );

  const contents: { id: string; internalDate: number; text: string }[] = [];
  for (let i = 0; i < fetched.length; i++) {
    const result = fetched[i];
    if (result.status === "fulfilled") {
      contents.push({
        id: result.value.id,
        internalDate: Number(result.value.internalDate),
        text: result.value.text,
      });
    } else {
      failures.push({ messageId: alerts[i].id, jobId: null, reason: reasonFor(result.reason) });
    }
  }

  contents.sort((a, b) => a.internalDate - b.internalDate);

  const allRows: VacancyRow[] = [];

  for (const message of contents) {
    try {
      const { cards, warnings: cardWarnings, failures: cardFailures } = parseLinkedInAlert(
        message.text
      );
      parserFailures.push(...toParserFailures(message.id, cardFailures));
      warningDetails.push(...toSyncWarnings(message.id, cardWarnings));
      allRows.push(...toVacancyRows(cards, message.id, new Date(message.internalDate)));
    } catch (error) {
      failures.push({ messageId: message.id, jobId: null, reason: reasonFor(error) });
    }
  }

  const uniqueRows = uniqueVacancyRows(allRows);
  counts.messages = alerts.length;
  counts.cards = allRows.length;
  counts.unique += uniqueRows.length;

  const inserted = await upsertRows(uniqueRows);
  counts.inserted += inserted;
  counts.skipped += uniqueRows.length - inserted;
}

async function syncGreenhouse(counts: Counts, failures: SyncRunDetail[]): Promise<void> {
  const firstSeenAt = new Date();

  for (const board of GREENHOUSE_BOARDS) {
    const label = `greenhouse:${board.identifier}`;
    let processed;
    try {
      processed = processBoard(await fetchBoardJobs(board), board, firstSeenAt);
    } catch (error) {
      failures.push({ messageId: label, jobId: null, reason: reasonFor(error) });
      continue;
    }
    for (const invalid of processed.invalid) {
      failures.push({ messageId: label, jobId: invalid.jobId, reason: invalid.reason });
    }

    const rows = uniqueVacancyRows(processed.passing);
    const inserted = await upsertRows(rows);
    counts.unique += rows.length;
    counts.inserted += inserted;
    counts.skipped += rows.length - inserted;
  }
}

export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const startedAt = new Date();
  const failures: SyncRunDetail[] = [];
  const parserFailures: SyncRunDetail[] = [];
  const warningDetails: SyncRunDetail[] = [];
  const counts: Counts = { messages: 0, cards: 0, unique: 0, inserted: 0, skipped: 0 };

  let crashed = false;
  let crash: unknown;

  try {
    await syncGmail(counts, failures, parserFailures, warningDetails);
  } catch (error) {
    crashed = true;
    crash = error;
    // A database error is already reported through the run's `error` field.
    if (!(error instanceof SyncDatabaseError)) {
      failures.push({ messageId: "gmail", jobId: null, reason: reasonFor(error) });
    }
  }

  const greenhouseEnabled = process.env.GREENHOUSE_SYNC_ENABLED === "true";
  if (greenhouseEnabled) {
    try {
      await syncGreenhouse(counts, failures);
    } catch (error) {
      if (!crashed) {
        crashed = true;
        crash = error;
      }
    }
  }

  if (crashed) {
    await recordSyncRun({
      trigger,
      startedAt,
      finishedAt: new Date(),
      status: "error",
      // Counts so far are only kept when Greenhouse ran, as Gmail-only crashes record none.
      counts: greenhouseEnabled
        ? {
            messages: counts.messages,
            cards: counts.cards,
            uniqueJobs: counts.unique,
            inserted: counts.inserted,
            skipped: counts.skipped,
            warnings: warningDetails.length,
            parserFailureCount: parserFailures.length,
          }
        : null,
      parserFailures,
      failures,
      warningDetails,
      error: reasonFor(crash),
    });

    throw crash;
  }

  const result: SyncResult = {
    messages: counts.messages,
    cards: counts.cards,
    unique: counts.unique,
    inserted: counts.inserted,
    skipped: counts.skipped,
    warnings: warningDetails.length,
    parserFailureCount: parserFailures.length,
    parserFailures,
    failures,
    warningDetails,
  };

  await recordSyncRun({
    trigger,
    startedAt,
    finishedAt: new Date(),
    status: "ok",
    counts: {
      messages: result.messages,
      cards: result.cards,
      uniqueJobs: result.unique,
      inserted: result.inserted,
      skipped: result.skipped,
      warnings: result.warnings,
      parserFailureCount: result.parserFailureCount,
    },
    parserFailures: result.parserFailures,
    failures: result.failures,
    warningDetails: result.warningDetails,
    error: null,
  });

  return result;
}
