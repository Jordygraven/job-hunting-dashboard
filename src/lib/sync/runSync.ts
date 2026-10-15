import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";
import { fetchMessageContent } from "@/lib/gmail/fetchMessageContent";
import { parseLinkedInAlert } from "@/lib/parsers/linkedin";
import { toVacancyRows, uniqueVacancyRows, type VacancyRow } from "@/lib/sync/vacancyRows";
import { toParserFailures } from "@/lib/sync/parserFailures";
import { toSyncWarnings } from "@/lib/sync/syncWarnings";
import type { SourceResult, SyncRunDetail } from "@/lib/sync/syncRunRecord";
import { SyncDatabaseError, upsertInChunks } from "@/lib/sync/upsertChunks";
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

const UPSERT_CHUNK_SIZE = 200;

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

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`sync step ${label} ${Date.now() - start}ms`);
  }
}

async function recordSyncRun(args: {
  runId: string;
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
  };
  sourceResults: SourceResult[];
  parserFailures: SyncRunDetail[];
  failures: SyncRunDetail[];
  warningDetails: SyncRunDetail[];
  error: string | null;
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("sync_runs").insert({
      run_id: args.runId,
      trigger: args.trigger,
      status: args.status,
      started_at: args.startedAt.toISOString(),
      finished_at: args.finishedAt.toISOString(),
      messages: args.counts.messages,
      cards: args.counts.cards,
      unique_jobs: args.counts.uniqueJobs,
      inserted: args.counts.inserted,
      skipped: args.counts.skipped,
      warnings: args.counts.warnings,
      parser_failure_count: args.counts.parserFailureCount,
      source_results: args.sourceResults,
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
}

async function upsertChunk(chunk: unknown[]): Promise<number> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancies")
    .upsert(chunk, { onConflict: "source,source_job_id", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(reasonFor(error));
  return data?.length ?? 0;
}

// The only place sync_run_id is stamped. Chunks done before a failure still reach `entry`.
async function upsertRows(rows: VacancyRow[], runId: string, entry: SourceResult): Promise<void> {
  const stamped = rows.map((row) => ({ ...row, sync_run_id: runId }));
  try {
    const inserted = await upsertInChunks(stamped, UPSERT_CHUNK_SIZE, upsertChunk);
    entry.inserted += inserted;
    entry.skipped += rows.length - inserted;
  } catch (error) {
    if (error instanceof SyncDatabaseError) {
      entry.inserted += error.inserted;
      entry.skipped += error.attempted - error.inserted;
    }
    throw error;
  }
}

async function syncGmail(
  counts: Counts,
  runId: string,
  entry: SourceResult,
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
      failures.push({
        messageId: alerts[i].id,
        jobId: null,
        reason: reasonFor(result.reason),
        source: "linkedin",
      });
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
      failures.push({
        messageId: message.id,
        jobId: null,
        reason: reasonFor(error),
        source: "linkedin",
      });
    }
  }

  const uniqueRows = uniqueVacancyRows(allRows);
  counts.messages = alerts.length;
  counts.cards = allRows.length;
  entry.found = uniqueRows.length;

  await upsertRows(uniqueRows, runId, entry);
}

async function syncGreenhouse(
  runId: string,
  results: SourceResult[],
  failures: SyncRunDetail[]
): Promise<void> {
  const firstSeenAt = new Date();

  for (const board of GREENHOUSE_BOARDS) {
    await timed(`greenhouse:${board.identifier}`, async () => {
      const entry: SourceResult = {
        source: "greenhouse",
        board: board.identifier,
        found: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
      };
      results.push(entry);
      const detail = { source: "greenhouse" as const, board: board.identifier };

      let processed;
      try {
        processed = processBoard(await fetchBoardJobs(board), board, firstSeenAt);
      } catch (error) {
        failures.push({ messageId: board.identifier, jobId: null, reason: reasonFor(error), ...detail });
        return;
      }
      for (const invalid of processed.invalid) {
        failures.push({ messageId: board.identifier, jobId: invalid.jobId, reason: invalid.reason, ...detail });
      }

      const rows = uniqueVacancyRows(processed.passing);
      entry.found = rows.length;
      await upsertRows(rows, runId, entry);
    });
  }
}

export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const failures: SyncRunDetail[] = [];
  const parserFailures: SyncRunDetail[] = [];
  const warningDetails: SyncRunDetail[] = [];
  const counts: Counts = { messages: 0, cards: 0 };
  const gmailEntry: SourceResult = { source: "linkedin", found: 0, inserted: 0, skipped: 0, failed: 0 };
  const sourceResults: SourceResult[] = [gmailEntry];
  const problems: unknown[] = [];

  try {
    await timed("gmail", () =>
      syncGmail(counts, runId, gmailEntry, failures, parserFailures, warningDetails)
    );
  } catch (error) {
    problems.push(error);
    // A database error is already reported through the run's `error` field.
    if (!(error instanceof SyncDatabaseError)) {
      failures.push({
        messageId: "gmail",
        jobId: null,
        reason: reasonFor(error),
        source: "linkedin",
      });
    }
  }

  if (process.env.GREENHOUSE_SYNC_ENABLED === "true") {
    try {
      await syncGreenhouse(runId, sourceResults, failures);
    } catch (error) {
      problems.push(error);
    }
  }

  for (const entry of sourceResults) {
    entry.failed = failures.filter(
      (f) => f.source === entry.source && f.board === entry.board
    ).length;
  }

  const sum = (key: "found" | "inserted" | "skipped") =>
    sourceResults.reduce((total, entry) => total + entry[key], 0);

  const result: SyncResult = {
    messages: counts.messages,
    cards: counts.cards,
    unique: sum("found"),
    inserted: sum("inserted"),
    skipped: sum("skipped"),
    warnings: warningDetails.length,
    parserFailureCount: parserFailures.length,
    parserFailures,
    failures,
    warningDetails,
  };

  await recordSyncRun({
    runId,
    trigger,
    startedAt,
    finishedAt: new Date(),
    status: problems.length > 0 ? "error" : "ok",
    counts: {
      messages: result.messages,
      cards: result.cards,
      uniqueJobs: result.unique,
      inserted: result.inserted,
      skipped: result.skipped,
      warnings: result.warnings,
      parserFailureCount: result.parserFailureCount,
    },
    sourceResults,
    parserFailures,
    failures,
    warningDetails,
    error: problems.length > 0 ? problems.map(reasonFor).join("\n") : null,
  });

  console.log(`sync step total ${Date.now() - startedAt.getTime()}ms`);

  if (problems.length > 0) {
    throw problems.find((p) => p instanceof SyncDatabaseError) ?? problems[0];
  }
  return result;
}
