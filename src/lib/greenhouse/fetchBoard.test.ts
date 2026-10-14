import { describe, expect, test, vi } from "vitest";
import { fetchBoardJobs } from "./fetchBoard";

const board = { identifier: "bybit", displayName: "Bybit" };
const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("fetchBoardJobs", () => {
  test("returns jobs and calls the board URL", async () => {
    const f = respond(200, { jobs: [{ id: 1 }] });
    expect(await fetchBoardJobs(board, f)).toEqual([{ id: 1 }]);
    expect(f.mock.calls[0][0]).toBe("https://boards-api.greenhouse.io/v1/boards/bybit/jobs");
  });

  test("non-200 throws the status code only", async () => {
    await expect(fetchBoardJobs(board, respond(503, "secret body"))).rejects.toThrow(/^HTTP 503$/);
  });

  test("bad JSON throws", async () => {
    await expect(fetchBoardJobs(board, respond(200, "<html>"))).rejects.toThrow("invalid JSON");
  });

  test("missing jobs array throws", async () => {
    await expect(fetchBoardJobs(board, respond(200, { jobs: null }))).rejects.toThrow("invalid response");
  });

  test("network error throws the error name only", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fetch failed: secret detail"));
    await expect(fetchBoardJobs(board, f)).rejects.toThrow(/^TypeError$/);
  });
});
