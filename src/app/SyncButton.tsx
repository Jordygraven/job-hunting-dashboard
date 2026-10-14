// src/app/SyncButton.tsx
"use client";

import { useActionState } from "react";
import { runManualSync } from "./actions";
import { pluralize } from "@/lib/format/pluralize";
import type { SyncResult } from "@/lib/sync/runSync";

type ActionState =
  | { status: "idle" }
  | { status: "ok"; result: SyncResult }
  | { status: "error"; message: string };

async function syncAction(_prevState: ActionState): Promise<ActionState> {
  const response = await runManualSync();
  if (response.ok) {
    return { status: "ok", result: response.result };
  }
  return { status: "error", message: response.message };
}

export function SyncButton() {
  const [state, formAction, isPending] = useActionState(syncAction, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>

      {state.status === "ok" && (
        <p className="text-sm text-text-secondary">
          Synced: {state.result.messages} messages, {state.result.cards} cards,{" "}
          {state.result.inserted} inserted, {state.result.skipped} skipped,{" "}
          {pluralize(state.result.warnings, "warning")}.
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-danger-fg">Sync failed: {state.message}</p>
      )}
    </form>
  );
}
