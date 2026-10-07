import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { IgnoreReason, VacancyActionRow } from "./types";
import { isValidAppliedOnDate, isValidIgnoreReason, isValidVacancyId } from "./validation";
import { SAFE_ERROR_MESSAGE } from "./errors";

export type WriteVacancyActionInput =
  | { intent: "apply"; vacancyId: number }
  | { intent: "ignore"; vacancyId: number; reason?: IgnoreReason }
  | { intent: "undo"; vacancyId: number }
  | { intent: "editAppliedDate"; vacancyId: number; appliedOn: string };

export type WriteVacancyActionResult = { ok: true } | { ok: false; error: string };

export async function writeVacancyAction(
  input: WriteVacancyActionInput
): Promise<WriteVacancyActionResult> {
  if (!isValidVacancyId(input.vacancyId)) {
    return { ok: false, error: "Invalid vacancy." };
  }

  if (input.intent === "ignore" && input.reason !== undefined && !isValidIgnoreReason(input.reason)) {
    return { ok: false, error: "Invalid ignore reason." };
  }

  if (input.intent === "editAppliedDate" && !isValidAppliedOnDate(input.appliedOn)) {
    return { ok: false, error: "Invalid date." };
  }

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }

  const { data: vacancy, error: vacancyError } = await supabase
    .from("vacancies")
    .select("id")
    .eq("id", input.vacancyId)
    .maybeSingle();

  if (vacancyError) {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }
  if (!vacancy) {
    return { ok: false, error: "Vacancy not found." };
  }

  const { data: actionRows, error: fetchError } = await supabase
    .from("vacancy_actions")
    .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
    .eq("vacancy_id", input.vacancyId)
    .order("id", { ascending: true });

  if (fetchError) {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }

  const rows: VacancyActionRow[] = (actionRows ?? []).map((row: any) => ({
    id: row.id,
    vacancyId: row.vacancy_id,
    action: row.action,
    ignoreReason: row.ignore_reason,
    appliedOn: row.applied_on,
    createdAt: row.created_at,
  }));

  const currentStatus = deriveVacancyStatus(rows);

  if (input.intent === "apply" && currentStatus.status === "applied") {
    return { ok: false, error: "Already marked as applied." };
  }
  if (input.intent === "ignore" && currentStatus.status === "ignored") {
    return { ok: false, error: "Already marked as ignored." };
  }
  if (input.intent === "undo" && currentStatus.status === "todo") {
    return { ok: false, error: "Nothing to undo." };
  }
  if (input.intent === "editAppliedDate" && currentStatus.status !== "applied") {
    return { ok: false, error: "Can only edit the date once applied." };
  }

  const insertRow: {
    vacancy_id: number;
    action: "applied" | "ignored" | "reset";
    applied_on?: string;
    ignore_reason?: IgnoreReason | null;
  } =
    input.intent === "apply"
      ? { vacancy_id: input.vacancyId, action: "applied", applied_on: getKlDateString() }
      : input.intent === "ignore"
        ? { vacancy_id: input.vacancyId, action: "ignored", ignore_reason: input.reason ?? null }
        : input.intent === "undo"
          ? { vacancy_id: input.vacancyId, action: "reset" }
          : { vacancy_id: input.vacancyId, action: "applied", applied_on: input.appliedOn };

  const { error: insertError } = await supabase.from("vacancy_actions").insert(insertRow);

  if (insertError) {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }

  return { ok: true };
}
