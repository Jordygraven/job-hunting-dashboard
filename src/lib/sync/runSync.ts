import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";
import { fetchMessageContent } from "@/lib/gmail/fetchMessageContent";
import { parseLinkedInAlert } from "@/lib/parsers/linkedin";
import { toVacancyRows, uniqueVacancyRows, type VacancyRow } from "@/lib/sync/vacancyRows";
import { toParserFailures, type ParserFailure } from "@/lib/sync/parserFailures";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SyncTrigger = "cron" | "manual";

export interface SyncFailure {
  messageId: string;
  reason: string;
}

export interface SyncResult {
  messages: number;
  cards: number;
  unique: number;
  inserted: number;
  skipped: number;
  warnings: number;
  parserFailureCount: number;
  parserFailures: ParserFailure[];
  failures: SyncFailure[];
}

export class SyncDatabaseError extends Error {}

function reasonFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as any).message;
    return typeof msg === "string" ? msg : "unknown error";
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
  parserFailures: ParserFailure[];
  failures: SyncFailure[];
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
      error: args.error,
    });

    if (error) {
      console.error("Failed to record sync_runs row:", error.message);
    }
  } catch (error) {
    console.error("Failed to record sync_runs row:", reasonFor(error));
  }
}

export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  const startedAt = new Date();
  const failures: SyncFailure[] = [];
  const parserFailures: ParserFailure[] = [];

  try {
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
        failures.push({ messageId: alerts[i].id, reason: reasonFor(result.reason) });
      }
    }

    contents.sort((a, b) => a.internalDate - b.internalDate);

    let warnings = 0;
    const allRows: VacancyRow[] = [];

    for (const message of contents) {
      try {
        const { cards, warnings: cardWarnings, failures: cardFailures } = parseLinkedInAlert(
          message.text
        );
        warnings += cardWarnings.length;
        parserFailures.push(...toParserFailures(message.id, cardFailures));
        allRows.push(...toVacancyRows(cards, message.id, new Date(message.internalDate)));
      } catch (error) {
        failures.push({ messageId: message.id, reason: reasonFor(error) });
      }
    }

    const uniqueRows = uniqueVacancyRows(allRows);

    let inserted = 0;
    if (uniqueRows.length > 0) {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("vacancies")
        .upsert(uniqueRows, { onConflict: "source,source_job_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        throw new SyncDatabaseError(reasonFor(error));
      }

      inserted = data?.length ?? 0;
    }

    const skipped = uniqueRows.length - inserted;
    const result: SyncResult = {
      messages: alerts.length,
      cards: allRows.length,
      unique: uniqueRows.length,
      inserted,
      skipped,
      warnings,
      parserFailureCount: parserFailures.length,
      parserFailures,
      failures,
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
      error: null,
    });

    return result;
  } catch (error) {
    await recordSyncRun({
      trigger,
      startedAt,
      finishedAt: new Date(),
      status: "error",
      counts: null,
      parserFailures,
      failures,
      error: reasonFor(error),
    });

    throw error;
  }
}
