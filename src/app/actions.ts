// src/app/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { runSync, type SyncResult } from "@/lib/sync/runSync";

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
