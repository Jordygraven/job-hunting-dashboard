// src/app/SyncButton.tsx
"use client";

import { useActionState } from "react";
import { runManualSync } from "./actions";
import type { SyncResult } from "@/lib/sync/runSync";

type ActionState =
  | { status: "idle" }
  | { status: "ok"; result: SyncResult }
  | { status: "error"; message: string };

async function syncAction(_prevState: ActionState): Promise<ActionState> {
  try {
    const result = await runManualSync();
    return { status: "ok", result };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncAction, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>

      {state.status === "ok" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Synced: {state.result.messages} messages, {state.result.cards} cards,{" "}
          {state.result.inserted} inserted, {state.result.skipped} skipped,{" "}
          {state.result.warnings} warnings.
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-700 dark:text-red-400">Sync failed: {state.message}</p>
      )}
    </form>
  );
}
