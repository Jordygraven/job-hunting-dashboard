import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SyncDatabaseError } from "@/lib/sync/upsertChunks";
import { recordBoardCheck } from "./recordBoardCheck";

function clientWith(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as any, from, insert };
}

describe("recordBoardCheck", () => {
  test("inserts one row with snake_case columns and returns ok", async () => {
    const { client, from, insert } = clientWith({ error: null });

    await expect(recordBoardCheck(client, { boardId: 7, status: "active", jobCount: 3 })).resolves.toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith("board_checks");
    expect(insert).toHaveBeenCalledWith({ board_id: 7, status: "active", job_count: 3 });
  });

  test("keeps a null job_count", async () => {
    const { client, insert } = clientWith({ error: null });
    await recordBoardCheck(client, { boardId: 7, status: "not_found", jobCount: null });
    expect(insert).toHaveBeenCalledWith({ board_id: 7, status: "not_found", job_count: null });
  });

  test("throws SyncDatabaseError when the insert fails", async () => {
    const { client } = clientWith({ error: { message: "checks down" } });
    const error = await recordBoardCheck(client, { boardId: 7, status: "empty", jobCount: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(SyncDatabaseError);
    expect(error.message).toBe("checks down");
  });
});
