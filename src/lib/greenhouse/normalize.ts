import type { VacancyRow } from "../sync/vacancyRows";
import type { GreenhouseBoard } from "../../config/greenhouseBoards";

export interface GreenhouseJob {
  id?: unknown;
  title?: unknown;
  location?: { name?: unknown } | null;
  absolute_url?: unknown;
}

export type NormalizeResult =
  | { ok: true; row: VacancyRow }
  | { ok: false; jobId: string | null; reason: string };

export function normalizeJob(job: GreenhouseJob, board: GreenhouseBoard, firstSeenAt: Date): NormalizeResult {
  const hasId = typeof job?.id === "number" || (typeof job?.id === "string" && job.id.trim() !== "");
  const title = typeof job?.title === "string" ? job.title.replace(/\s+/g, " ").trim() : "";
  const url = typeof job?.absolute_url === "string" ? job.absolute_url : "";

  const missing = [!hasId && "id", !title && "title", !url.trim() && "absolute_url"].filter(Boolean);
  if (missing.length > 0) {
    return {
      ok: false,
      jobId: hasId ? String(job.id) : null,
      reason: `job missing ${missing.join(", ")}`,
    };
  }

  const rawLocation = job.location?.name;
  const location = typeof rawLocation === "string" ? rawLocation.trim() || null : null;

  return {
    ok: true,
    row: {
      source: "greenhouse",
      source_job_id: String(job.id),
      title,
      company: board.displayName,
      location,
      url,
      first_seen_at: firstSeenAt.toISOString(),
      source_message_id: null,
    },
  };
}
