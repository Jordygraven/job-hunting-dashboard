import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import type { VacancyActionRow, VacancyStatus } from "./types";

export function deriveVacancyStatus(rows: VacancyActionRow[]): VacancyStatus {
  if (rows.length === 0) {
    return { status: "todo" };
  }

  const latest = rows.reduce((highest, row) => (row.id > highest.id ? row : highest));

  if (latest.action === "reset") {
    return { status: "todo" };
  }

  if (latest.action === "applied") {
    return { status: "applied", appliedOn: latest.appliedOn as string };
  }

  return {
    status: "ignored",
    reason: latest.ignoreReason,
    date: getKlDateString(new Date(latest.createdAt)),
  };
}
