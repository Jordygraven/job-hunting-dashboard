import type { GreenhouseBoard } from "../../config/greenhouseBoards";
import type { GreenhouseJob } from "./normalize";

const TIMEOUT_MS = 10_000;

export class BoardHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

// Error messages hold only a status code or an error name, never a response body.
export async function fetchBoardJobs(
  board: GreenhouseBoard,
  fetchImpl: typeof fetch = fetch
): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.identifier)}/jobs`;

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new Error(error instanceof Error ? error.name : "fetch error");
  }
  if (response.status !== 200) throw new BoardHttpError(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("invalid JSON");
  }

  const jobs = (body as { jobs?: unknown } | null)?.jobs;
  if (!Array.isArray(jobs)) throw new Error("invalid response: no jobs array");
  return jobs as GreenhouseJob[];
}
