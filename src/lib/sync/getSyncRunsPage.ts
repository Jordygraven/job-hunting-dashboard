import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SYNC_RUN_COLUMNS, mapSyncRunRows } from "./getRecentSyncRuns";
import { clampPage } from "./pageParam";
import type { SyncRunRecord } from "./syncRunRecord";

export const SYNCS_PAGE_SIZE = 5;

export async function getSyncRunsPage(
  rawPage: string | string[] | undefined
): Promise<{ runs: SyncRunRecord[]; page: number; totalPages: number }> {
  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from("sync_runs")
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);

  const totalPages = Math.max(Math.ceil((count ?? 0) / SYNCS_PAGE_SIZE), 1);
  const page = clampPage(rawPage, totalPages);
  const from = (page - 1) * SYNCS_PAGE_SIZE;

  const { data, error } = await supabase
    .from("sync_runs")
    .select(SYNC_RUN_COLUMNS)
    .order("id", { ascending: false })
    .range(from, from + SYNCS_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  return { runs: mapSyncRunRows(data ?? []), page, totalPages };
}
