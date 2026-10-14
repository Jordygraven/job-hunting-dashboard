// Carries the counts of chunks that finished before the failing one, so the run can still record them.
export class SyncDatabaseError extends Error {
  constructor(
    message: string,
    readonly inserted = 0,
    readonly attempted = 0
  ) {
    super(message);
  }
}

export async function upsertInChunks<T>(
  rows: T[],
  size: number,
  upsertChunk: (chunk: T[]) => Promise<number>
): Promise<number> {
  let inserted = 0;
  let attempted = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    try {
      inserted += await upsertChunk(chunk);
    } catch (error) {
      throw new SyncDatabaseError(
        error instanceof Error ? error.message : "unknown error",
        inserted,
        attempted
      );
    }
    attempted += chunk.length;
  }
  return inserted;
}
