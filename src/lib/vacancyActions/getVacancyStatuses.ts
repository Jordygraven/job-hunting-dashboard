import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows, SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import { mapVacancyActionRow, type VacancyActionDbRow } from "./mapVacancyActionRow";
import type { VacancyActionRow, VacancyStatus } from "./types";

export async function getVacancyStatuses(): Promise<Map<number, VacancyStatus>> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyActionDbRow>(async (after) => {
    let query = supabase
      .from("vacancy_actions")
      .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
      .order("id", { ascending: false })
      .limit(SUPABASE_MAX_ROWS);

    if (after) {
      query = query.lt("id", after.id);
    }

    return query;
  });

  const latestRowByVacancyId = new Map<number, VacancyActionRow>();
  for (const row of rows) {
    const mapped = mapVacancyActionRow(row);
    // Rows arrive highest id first, so the first row seen for a vacancy is its latest.
    if (!latestRowByVacancyId.has(mapped.vacancyId)) {
      latestRowByVacancyId.set(mapped.vacancyId, mapped);
    }
  }

  const statuses = new Map<number, VacancyStatus>();
  for (const [vacancyId, latestRow] of latestRowByVacancyId) {
    statuses.set(vacancyId, deriveVacancyStatus([latestRow]));
  }
  return statuses;
}
