import { fetchLinkedInAlerts } from "@/lib/gmail/fetchLinkedInAlerts";
import { fetchMessageContent } from "@/lib/gmail/fetchMessageContent";
import { parseLinkedInAlert } from "@/lib/parsers/linkedin";
import { toVacancyRows, uniqueVacancyRows, type VacancyRow } from "@/lib/sync/vacancyRows";
import { toParserFailures, type ParserFailure } from "@/lib/sync/parserFailures";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface SyncFailure {
  messageId: string;
  reason: string;
}

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const alerts = await fetchLinkedInAlerts();
  const failures: SyncFailure[] = [];

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
  const parserFailures: ParserFailure[] = [];

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
      return Response.json({ error: "database error" }, { status: 500 });
    }

    inserted = data?.length ?? 0;
  }

  return Response.json({
    messages: alerts.length,
    cards: allRows.length,
    unique: uniqueRows.length,
    inserted,
    skipped: uniqueRows.length - inserted,
    warnings,
    parserFailureCount: parserFailures.length,
    parserFailures,
    failures,
  });
}
