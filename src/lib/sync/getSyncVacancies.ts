import { GREENHOUSE_BOARDS } from "@/config/greenhouseBoards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SourceResult, SyncRunRecord } from "./syncRunRecord";

export const VACANCY_LIST_LIMIT = 100;
export const LIST_NOT_AVAILABLE = "list-not-available" as const;

export interface VacancyLine {
  title: string;
  company: string;
  url: string;
}

export interface SourceGroup {
  source: SourceResult["source"];
  // Display name for a known Greenhouse board, the stored identifier otherwise.
  label: string;
  inserted: number;
  // null: no list (board not in config, so no query ran).
  lines: VacancyLine[] | null;
  more: number;
}

type Client = ReturnType<typeof getSupabaseServerClient>;

// Stored `board` is the identifier; vacancies.company holds the display name.
function displayNameFor(entry: SourceResult): string | null {
  if (entry.source !== "greenhouse") return null;
  return GREENHOUSE_BOARDS.find((b) => b.identifier === entry.board)?.displayName ?? null;
}

async function fetchEntryLines(
  client: Client,
  runId: string,
  entry: SourceResult
): Promise<VacancyLine[] | null> {
  const name = displayNameFor(entry);
  if (entry.source === "greenhouse" && !name) return null;
  if (entry.inserted === 0) return [];

  let query = client
    .from("vacancies")
    .select("title, company, url")
    .eq("sync_run_id", runId)
    .eq("source", entry.source);

  if (name) query = query.eq("company", name);

  const { data, error } = await query.order("id", { ascending: true }).limit(VACANCY_LIST_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as VacancyLine[];
}

// One query per source_results entry; none for runs without a runId or source_results.
export async function getSyncVacancies(
  runs: SyncRunRecord[],
  client: Client = getSupabaseServerClient()
): Promise<Map<number, SourceGroup[] | typeof LIST_NOT_AVAILABLE>> {
  const out = new Map<number, SourceGroup[] | typeof LIST_NOT_AVAILABLE>();
  await Promise.all(
    runs.map(async (run) => {
      const { runId, sourceResults } = run;
      if (!runId || !sourceResults) return out.set(run.id, LIST_NOT_AVAILABLE);
      const lists = await Promise.all(sourceResults.map((e) => fetchEntryLines(client, runId, e)));
      out.set(run.id, toSourceGroups(run, lists));
    })
  );
  return out;
}

// `lists[i]` belongs to `run.sourceResults[i]`.
export function toSourceGroups(
  run: Pick<SyncRunRecord, "runId" | "sourceResults">,
  lists: (VacancyLine[] | null)[]
): SourceGroup[] | typeof LIST_NOT_AVAILABLE {
  if (!run.runId || !run.sourceResults) return LIST_NOT_AVAILABLE;
  return run.sourceResults.map((entry, i) => {
    const lines = lists[i] ?? null;
    return {
      source: entry.source,
      label: displayNameFor(entry) ?? entry.board ?? "LinkedIn",
      inserted: entry.inserted,
      lines,
      more: Math.max(entry.inserted - (lines?.length ?? 0), 0),
    };
  });
}
