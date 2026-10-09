import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows, SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";
import { deriveStarred, deriveVacancyStatus } from "./deriveVacancyStatus";
import { mapVacancyActionRow, type VacancyActionDbRow } from "./mapVacancyActionRow";
import type { VacancyActionRow, VacancyStatus } from "./types";

export type VacancyFlags = { status: VacancyStatus; starred: boolean };

export async function getVacancyFlags(): Promise<Map<number, VacancyFlags>> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyActionDbRow>(async (after) => {
    let query = supabase
      .from("vacancy_actions")
      .select("id, vacancy_id, action, ignore_reason, applied_on, outcome_on, created_at")
      .order("id", { ascending: false })
      .limit(SUPABASE_MAX_ROWS);

    if (after) {
      query = query.lt("id", after.id);
    }

    return query;
  });

  const rowsByVacancyId = new Map<number, VacancyActionRow[]>();
  for (const row of rows) {
    const mapped = mapVacancyActionRow(row);
    const existing = rowsByVacancyId.get(mapped.vacancyId);
    if (existing) {
      existing.push(mapped);
    } else {
      rowsByVacancyId.set(mapped.vacancyId, [mapped]);
    }
  }

  const flags = new Map<number, VacancyFlags>();
  for (const [vacancyId, vacancyRows] of rowsByVacancyId) {
    flags.set(vacancyId, {
      status: deriveVacancyStatus(vacancyRows),
      starred: deriveStarred(vacancyRows),
    });
  }
  return flags;
}
