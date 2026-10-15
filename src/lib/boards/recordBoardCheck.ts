import type { getSupabaseServerClient } from "@/lib/supabase/server";
import { SyncDatabaseError } from "@/lib/sync/upsertChunks";
import type { CheckStatus } from "./types";

type Client = ReturnType<typeof getSupabaseServerClient>;

// Insert-only: board_checks is append-only and the sync never reads a row back.
export async function recordBoardCheck(
  client: Client,
  input: { boardId: number; status: CheckStatus; jobCount: number | null }
): Promise<{ ok: true }> {
  const { error } = await client
    .from("board_checks")
    .insert({ board_id: input.boardId, status: input.status, job_count: input.jobCount });
  if (error) throw new SyncDatabaseError(error.message);
  return { ok: true };
}
