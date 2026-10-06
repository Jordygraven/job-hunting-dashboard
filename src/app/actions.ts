// src/app/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { runSync, type SyncResult } from "@/lib/sync/runSync";

export async function runManualSync(): Promise<SyncResult> {
  const result = await runSync("manual");
  revalidatePath("/");
  return result;
}
