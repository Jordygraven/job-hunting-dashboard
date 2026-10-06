import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { VacancyActionRow, VacancyStatus } from "./types";

export async function getVacancyStatuses(): Promise<Map<number, VacancyStatus>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancy_actions")
    .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rowsByVacancyId = new Map<number, VacancyActionRow[]>();
  for (const row of data ?? []) {
    const mapped: VacancyActionRow = {
      id: row.id,
      vacancyId: row.vacancy_id,
      action: row.action,
      ignoreReason: row.ignore_reason,
      appliedOn: row.applied_on,
      createdAt: row.created_at,
    };
    const group = rowsByVacancyId.get(mapped.vacancyId) ?? [];
    group.push(mapped);
    rowsByVacancyId.set(mapped.vacancyId, group);
  }

  const statuses = new Map<number, VacancyStatus>();
  for (const [vacancyId, rows] of rowsByVacancyId) {
    statuses.set(vacancyId, deriveVacancyStatus(rows));
  }
  return statuses;
}
