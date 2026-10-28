import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import { PILOT_ACTIONS, STAR_ACTIONS, STATUS_ACTIONS } from "./types";
import type { VacancyActionRow, VacancyStatus } from "./types";

function latestById(rows: VacancyActionRow[]): VacancyActionRow {
  return rows.reduce((highest, row) => (row.id > highest.id ? row : highest));
}

// The chain into an outcome is always applied -> success or applied -> success
// -> rejected, so scanning the status-row history backwards from the outcome
// row always finds exactly one preceding applied row.
function findPrecedingAppliedOn(statusRows: VacancyActionRow[], beforeId: number): string {
  const preceding = statusRows.filter((row) => row.action === "applied" && row.id < beforeId);
  if (preceding.length === 0) {
    throw new Error(`No preceding applied row found before row ${beforeId}`);
  }
  const applied = latestById(preceding);
  if (typeof applied.appliedOn !== "string") {
    throw new Error(`Applied action row ${applied.id} is missing appliedOn`);
  }
  return applied.appliedOn;
}

export function deriveVacancyStatus(rows: VacancyActionRow[]): VacancyStatus {
  const statusRows = rows.filter((row) => (STATUS_ACTIONS as readonly string[]).includes(row.action));

  if (statusRows.length === 0) {
    return { status: "todo" };
  }

  const latest = latestById(statusRows);

  if (latest.action === "reset") {
    return { status: "todo" };
  }

  if (latest.action === "applied") {
    if (typeof latest.appliedOn !== "string") {
      throw new Error(`Applied action row ${latest.id} is missing appliedOn`);
    }
    return { status: "applied", appliedOn: latest.appliedOn };
  }

  if (latest.action === "success" || latest.action === "rejected") {
    if (typeof latest.outcomeOn !== "string") {
      throw new Error(`${latest.action} action row ${latest.id} is missing outcomeOn`);
    }
    const appliedOn = findPrecedingAppliedOn(statusRows, latest.id);
    return { status: latest.action, appliedOn, outcomeOn: latest.outcomeOn };
  }

  return {
    status: "ignored",
    reason: latest.ignoreReason,
    date: getKlDateString(new Date(latest.createdAt)),
  };
}

export function deriveStarred(rows: VacancyActionRow[]): boolean {
  const starRows = rows.filter((row) => (STAR_ACTIONS as readonly string[]).includes(row.action));

  if (starRows.length === 0) {
    return false;
  }

  return latestById(starRows).action === "starred";
}

function latestIsAction(rows: VacancyActionRow[], family: readonly string[], action: string): boolean {
  const familyRows = rows.filter((row) => family.includes(row.action));
  return familyRows.length > 0 && latestById(familyRows).action === action;
}

export function deriveAutoDraft(rows: VacancyActionRow[]): boolean {
  return latestIsAction(rows, ["automated_draft", "automated_draft_cleared"], "automated_draft");
}

export function derivePilot(rows: VacancyActionRow[]): boolean {
  return latestIsAction(rows, PILOT_ACTIONS, "pilot");
}

export function deriveDrafted(rows: VacancyActionRow[]): boolean {
  return rows.some((row) => row.action === "automated_draft_done");
}

// A drafted vacancy never returns to the queue, even after a later automated_draft row.
export function deriveInQueue(rows: VacancyActionRow[]): boolean {
  return deriveAutoDraft(rows) && !deriveDrafted(rows) && deriveVacancyStatus(rows).status !== "applied";
}
