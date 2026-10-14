import { describe, expect, test } from "vitest";
import { SyncDatabaseError, upsertInChunks } from "./upsertChunks";

describe("upsertInChunks", () => {
  test("splits rows by size and sums inserted", async () => {
    const sizes: number[] = [];
    const inserted = await upsertInChunks([1, 2, 3, 4, 5], 2, async (c) => {
      sizes.push(c.length);
      return c.length;
    });
    expect(sizes).toEqual([2, 2, 1]);
    expect(inserted).toBe(5);
  });

  test("no rows, no calls", async () => {
    expect(await upsertInChunks([], 2, async () => 1)).toBe(0);
  });

  test("failing chunk throws SyncDatabaseError with earlier chunks' counts", async () => {
    let n = 0;
    const error = await upsertInChunks([1, 2, 3, 4, 5], 2, async () => {
      if (++n === 2) throw new Error("boom");
      return 1;
    }).catch((e) => e);
    expect(error).toBeInstanceOf(SyncDatabaseError);
    expect(error).toMatchObject({ message: "boom", inserted: 1, attempted: 2 });
  });
});
