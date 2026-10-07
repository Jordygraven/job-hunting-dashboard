import type { VacancyActionRow } from "./types";

export type VacancyActionDbRow = {
  id: number;
  vacancy_id: number;
  action: VacancyActionRow["action"];
  ignore_reason: VacancyActionRow["ignoreReason"];
  applied_on: string | null;
  created_at: string;
};

export function mapVacancyActionRow(row: VacancyActionDbRow): VacancyActionRow {
  return {
    id: row.id,
    vacancyId: row.vacancy_id,
    action: row.action,
    ignoreReason: row.ignore_reason,
    appliedOn: row.applied_on,
    createdAt: row.created_at,
  };
}
