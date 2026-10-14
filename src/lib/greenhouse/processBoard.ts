import type { VacancyRow } from "../sync/vacancyRows";
import type { GreenhouseBoard } from "../../config/greenhouseBoards";
import { passesFilter, passesLocation, passesTitle } from "./filter";
import { normalizeJob, type GreenhouseJob } from "./normalize";

export interface ProcessedBoard {
  total: number;
  passing: VacancyRow[];
  // Title passes but location fails: only used by the dry run.
  locationRejected: VacancyRow[];
  invalid: { jobId: string | null; reason: string }[];
}

export function processBoard(jobs: GreenhouseJob[], board: GreenhouseBoard, firstSeenAt: Date): ProcessedBoard {
  const result: ProcessedBoard = { total: jobs.length, passing: [], locationRejected: [], invalid: [] };
  for (const job of jobs) {
    const normalized = normalizeJob(job, board, firstSeenAt);
    if (!normalized.ok) {
      result.invalid.push({ jobId: normalized.jobId, reason: normalized.reason });
    } else if (passesFilter(normalized.row.title, normalized.row.location)) {
      result.passing.push(normalized.row);
    } else if (passesTitle(normalized.row.title) && !passesLocation(normalized.row.location)) {
      result.locationRejected.push(normalized.row);
    }
  }
  return result;
}
