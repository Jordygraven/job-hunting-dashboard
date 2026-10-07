import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import { mapVacancyActionRow, type VacancyActionDbRow } from "./mapVacancyActionRow";
import type { VacancyActionRow, VacancyStatus } from "./types";

export async function getVacancyStatuses(): Promise<Map<number, VacancyStatus>> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyActionDbRow>(async (from, to) =>
    supabase
      .from("vacancy_actions")
      .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
      .order("id", { ascending: false })
      .range(from, to)
  );

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
