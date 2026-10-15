import { fetchAllRows, SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";
import type { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Board, Portal } from "./types";

type Client = ReturnType<typeof getSupabaseServerClient>;
type BoardDbRow = { id: number; portal: Portal; identifier: string; display_name: string };

export async function getBoards(client: Client, portal: Portal): Promise<Board[]> {
  const rows = await fetchAllRows<BoardDbRow>(async (after) => {
    let query = client
      .from("boards")
      .select("id, portal, identifier, display_name")
      .eq("portal", portal)
      .order("id", { ascending: true })
      .limit(SUPABASE_MAX_ROWS);

    if (after) {
      query = query.gt("id", after.id);
    }

    return query;
  });

  return rows.map((r) => ({ id: r.id, portal: r.portal, identifier: r.identifier, displayName: r.display_name }));
}
