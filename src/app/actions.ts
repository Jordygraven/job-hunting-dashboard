// src/app/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { runSync, type SyncResult } from "@/lib/sync/runSync";
import {
  writeVacancyAction,
  type WriteVacancyActionResult,
} from "@/lib/vacancyActions/writeVacancyAction";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

export async function runManualSync(): Promise<
  { ok: true; result: SyncResult } | { ok: false; message: string }
> {
  try {
    const result = await runSync("manual");
    return { ok: true, result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "unknown error" };
  } finally {
    revalidatePath("/");
  }
}

export async function apply(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "apply", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function ignore(
  vacancyId: number,
  reason?: IgnoreReason
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "ignore", vacancyId, reason });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function undo(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "undo", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function editAppliedDate(
  vacancyId: number,
  appliedOn: string
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "editAppliedDate", vacancyId, appliedOn });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function markSuccess(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "markSuccess", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function markReject(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "markReject", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function editOutcomeDate(
  vacancyId: number,
  outcomeOn: string
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "editOutcomeDate", vacancyId, outcomeOn });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function star(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "star", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function unstar(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "unstar", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function toggleAutoDraft(
  vacancyId: number,
  marked: boolean
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({
    intent: marked ? "clearAutoDraft" : "autoDraft",
    vacancyId,
  });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}
