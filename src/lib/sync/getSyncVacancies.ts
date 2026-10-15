import { getBoards } from "@/lib/boards/getBoards";
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
  // null: no list (board not in the boards table, so no query ran).
  lines: VacancyLine[] | null;
  more: number;
}

type Client = ReturnType<typeof getSupabaseServerClient>;

// Greenhouse identifier -> display name.
type Names = Map<string, string>;

// Stored `board` is the identifier; vacancies.company holds the display name.
function displayNameFor(entry: SourceResult, names: Names): string | null {
  if (entry.source !== "greenhouse" || !entry.board) return null;
  return names.get(entry.board) ?? null;
}

async function fetchEntryLines(
  client: Client,
  runId: string,
  entry: SourceResult,
  names: Names
): Promise<VacancyLine[] | null> {
  const name = displayNameFor(entry, names);
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
  // Identifiers are only unique per portal, so read greenhouse boards only.
  const names: Names = new Map((await getBoards(client, "greenhouse")).map((b) => [b.identifier, b.displayName]));
  await Promise.all(
    runs.map(async (run) => {
      const { runId, sourceResults } = run;
      if (!runId || !sourceResults) return out.set(run.id, LIST_NOT_AVAILABLE);
      const lists = await Promise.all(sourceResults.map((e) => fetchEntryLines(client, runId, e, names)));
      out.set(run.id, toSourceGroups(run, lists, names));
    })
  );
  return out;
}

// `lists[i]` belongs to `run.sourceResults[i]`.
export function toSourceGroups(
  run: Pick<SyncRunRecord, "runId" | "sourceResults">,
  lists: (VacancyLine[] | null)[],
  names: Names
): SourceGroup[] | typeof LIST_NOT_AVAILABLE {
  if (!run.runId || !run.sourceResults) return LIST_NOT_AVAILABLE;
  return run.sourceResults.map((entry, i) => {
    const lines = lists[i] ?? null;
    return {
      source: entry.source,
      label: displayNameFor(entry, names) ?? entry.board ?? "LinkedIn",
      inserted: entry.inserted,
      lines,
      more: Math.max(entry.inserted - (lines?.length ?? 0), 0),
    };
  });
}
