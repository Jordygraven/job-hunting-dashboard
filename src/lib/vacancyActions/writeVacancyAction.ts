import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getKlDateString, isDateNotInFutureKl, isValidDateString } from "@/lib/format/kualaLumpurDate";
import { deriveAutoDraft, deriveDrafted, derivePilot, deriveStarred, deriveVacancyStatus } from "./deriveVacancyStatus";
import { mapVacancyActionRow } from "./mapVacancyActionRow";
import type { IgnoreReason } from "./types";
import {
  isValidAppliedOnDate,
  isValidIgnoreReason,
  isValidOutcomeOnDate,
  isValidVacancyId,
} from "./validation";
import { SAFE_ERROR_MESSAGE } from "./errors";

export type WriteVacancyActionInput =
  | { intent: "apply"; vacancyId: number }
  | { intent: "ignore"; vacancyId: number; reason?: IgnoreReason }
  | { intent: "undo"; vacancyId: number }
  | { intent: "editAppliedDate"; vacancyId: number; appliedOn: string }
  | { intent: "markSuccess"; vacancyId: number }
  | { intent: "markReject"; vacancyId: number }
  | { intent: "editOutcomeDate"; vacancyId: number; outcomeOn: string }
  | { intent: "star"; vacancyId: number }
  | { intent: "unstar"; vacancyId: number }
  | { intent: "autoDraft"; vacancyId: number }
  | { intent: "clearAutoDraft"; vacancyId: number }
  | { intent: "pilot"; vacancyId: number }
  | { intent: "clearPilot"; vacancyId: number };

export type WriteVacancyActionResult = { ok: true } | { ok: false; error: string };

type VacancyActionInsertRow =
  | { vacancy_id: number; action: "applied"; applied_on: string }
  | { vacancy_id: number; action: "ignored"; ignore_reason: IgnoreReason | null }
  | { vacancy_id: number; action: "reset" }
  | { vacancy_id: number; action: "success"; outcome_on: string }
  | { vacancy_id: number; action: "rejected"; outcome_on: string }
  | { vacancy_id: number; action: "starred" }
  | { vacancy_id: number; action: "unstarred" }
  | { vacancy_id: number; action: "automated_draft" }
  | { vacancy_id: number; action: "automated_draft_cleared" }
  | { vacancy_id: number; action: "pilot" }
  | { vacancy_id: number; action: "pilot_cleared" };

// supabase-js's insert() overloads can't resolve a union argument; widen to this
// flat shape for the call itself, while construction above stays a discriminated
// union so each branch can't pair the wrong field with the wrong action.
type VacancyActionInsertPayload = {
  vacancy_id: number;
  action:
    | "applied"
    | "ignored"
    | "reset"
    | "success"
    | "rejected"
    | "starred"
    | "unstarred"
    | "automated_draft"
    | "automated_draft_cleared"
    | "pilot"
    | "pilot_cleared";
  applied_on?: string;
  ignore_reason?: IgnoreReason | null;
  outcome_on?: string;
};

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

  let supabase: ReturnType<typeof getSupabaseServerClient>;
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
    .select("id, vacancy_id, action, ignore_reason, applied_on, outcome_on, created_at")
    .eq("vacancy_id", input.vacancyId)
    .order("id", { ascending: true });

  if (fetchError) {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }

  const rows = (actionRows ?? []).map(mapVacancyActionRow);

  const currentStatus = deriveVacancyStatus(rows);
  const starred = deriveStarred(rows);
  const autoDraft = deriveAutoDraft(rows);
  const pilot = derivePilot(rows);

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
  if (
    input.intent === "editAppliedDate" &&
    currentStatus.status === "applied" &&
    input.appliedOn === currentStatus.appliedOn
  ) {
    return { ok: true };
  }
  if (input.intent === "markSuccess" && currentStatus.status !== "applied") {
    return { ok: false, error: "Can only mark as success once applied." };
  }
  if (
    input.intent === "markReject" &&
    currentStatus.status !== "applied" &&
    currentStatus.status !== "success"
  ) {
    return { ok: false, error: "Can only reject once applied or marked as success." };
  }
  if (input.intent === "editOutcomeDate" && currentStatus.status !== "success" && currentStatus.status !== "rejected") {
    return { ok: false, error: "Can only edit the outcome date once there's an outcome." };
  }
  if (input.intent === "editOutcomeDate" && (currentStatus.status === "success" || currentStatus.status === "rejected")) {
    const appliedOn = currentStatus.appliedOn;
    const hasValidOutcomeOn = isValidOutcomeOnDate(input.outcomeOn, appliedOn);
    if (!hasValidOutcomeOn) {
      if (
        isValidDateString(input.outcomeOn) &&
        isDateNotInFutureKl(input.outcomeOn) &&
        input.outcomeOn < appliedOn
      ) {
        return {
          ok: false,
          error: `Outcome date can't be before the applied date (${appliedOn}).`,
        };
      }
      return { ok: false, error: "Invalid date." };
    }
    if (input.outcomeOn === currentStatus.outcomeOn) {
      return { ok: true };
    }
  }
  if (input.intent === "star" && currentStatus.status !== "todo") {
    return { ok: false, error: "Can only star a To do vacancy." };
  }
  if (input.intent === "star" && starred) {
    return { ok: false, error: "Already starred." };
  }
  if (input.intent === "unstar" && !starred) {
    return { ok: false, error: "Not starred." };
  }
  if ((input.intent === "autoDraft" || input.intent === "clearAutoDraft") && deriveDrafted(rows)) {
    return { ok: false, error: "Already drafted." };
  }
  if (input.intent === "autoDraft" && autoDraft) {
    return { ok: false, error: "Already marked for auto-draft." };
  }
  if (input.intent === "clearAutoDraft" && !autoDraft) {
    return { ok: false, error: "Not marked for auto-draft." };
  }
  if (input.intent === "pilot" && pilot) {
    return { ok: false, error: "Already marked as pilot." };
  }
  if (input.intent === "clearPilot" && !pilot) {
    return { ok: false, error: "Not marked as pilot." };
  }

  let insertRow: VacancyActionInsertRow;
  switch (input.intent) {
    case "apply":
      insertRow = { vacancy_id: input.vacancyId, action: "applied", applied_on: getKlDateString() };
      break;
    case "ignore":
      insertRow = { vacancy_id: input.vacancyId, action: "ignored", ignore_reason: input.reason ?? null };
      break;
    case "undo":
      insertRow =
        currentStatus.status === "success" || currentStatus.status === "rejected"
          ? { vacancy_id: input.vacancyId, action: "applied", applied_on: currentStatus.appliedOn }
          : { vacancy_id: input.vacancyId, action: "reset" };
      break;
    case "editAppliedDate":
      insertRow = { vacancy_id: input.vacancyId, action: "applied", applied_on: input.appliedOn };
      break;
    case "markSuccess":
      insertRow = { vacancy_id: input.vacancyId, action: "success", outcome_on: getKlDateString() };
      break;
    case "markReject":
      insertRow = { vacancy_id: input.vacancyId, action: "rejected", outcome_on: getKlDateString() };
      break;
    case "editOutcomeDate":
      insertRow =
        currentStatus.status === "rejected"
          ? { vacancy_id: input.vacancyId, action: "rejected", outcome_on: input.outcomeOn }
          : { vacancy_id: input.vacancyId, action: "success", outcome_on: input.outcomeOn };
      break;
    case "star":
      insertRow = { vacancy_id: input.vacancyId, action: "starred" };
      break;
    case "unstar":
      insertRow = { vacancy_id: input.vacancyId, action: "unstarred" };
      break;
    case "autoDraft":
      insertRow = { vacancy_id: input.vacancyId, action: "automated_draft" };
      break;
    case "clearAutoDraft":
      insertRow = { vacancy_id: input.vacancyId, action: "automated_draft_cleared" };
      break;
    case "pilot":
      insertRow = { vacancy_id: input.vacancyId, action: "pilot" };
      break;
    case "clearPilot":
      insertRow = { vacancy_id: input.vacancyId, action: "pilot_cleared" };
      break;
  }

  const { error: insertError } = await supabase
    .from("vacancy_actions")
    .insert(insertRow as VacancyActionInsertPayload);

  if (insertError) {
    return { ok: false, error: SAFE_ERROR_MESSAGE };
  }

  return { ok: true };
}
