import { fetchAllRows, SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";
import type { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BoardCheck, CheckStatus } from "./types";

type Client = ReturnType<typeof getSupabaseServerClient>;
type CheckDbRow = { id: number; board_id: number; status: CheckStatus; job_count: number | null; checked_at: string };

// shortcut: reads every check row, about one per board per day; upgrade to a latest-per-board view or per-board limit(1) past about 50,000 rows.
export async function getLatestChecks(client: Client): Promise<Map<number, BoardCheck>> {
  const rows = await fetchAllRows<CheckDbRow>(async (after) => {
    let query = client
      .from("board_checks")
      .select("id, board_id, status, job_count, checked_at")
      .order("id", { ascending: false })
      .limit(SUPABASE_MAX_ROWS);

    if (after) {
      query = query.lt("id", after.id);
    }

    return query;
  });

  const latest = new Map<number, BoardCheck>();
  for (const r of rows) {
    if (!latest.has(r.board_id)) {
      latest.set(r.board_id, { boardId: r.board_id, status: r.status, jobCount: r.job_count, checkedAt: r.checked_at });
    }
  }
  return latest;
}
