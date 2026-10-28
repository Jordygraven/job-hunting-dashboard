// src/app/AutomationToggle.tsx
"use client";

import { useState } from "react";
import { toggleAutoDraft, togglePilot } from "./actions";
import { SAFE_ERROR_MESSAGE } from "@/lib/vacancyActions/errors";

const TOGGLE_CLASS =
  "whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
const OFF_CLASS =
  "border-border-control bg-surface-control text-text-primary hover:border-border-control-hover hover:bg-surface-control-hover";
const ON_CLASS = "border-accent bg-accent text-accent-foreground hover:bg-accent-hover";

type ToggleResult = { ok: true } | { ok: false; error: string };

function MarkToggle({
  marked,
  text,
  markLabel,
  unmarkLabel,
  write,
}: {
  marked: boolean;
  text: string;
  markLabel: string;
  unmarkLabel: string;
  write: () => Promise<ToggleResult>;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setIsPending(true);
    setError(null);
    try {
      const result = await write();
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError(SAFE_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={`${TOGGLE_CLASS} ${marked ? ON_CLASS : OFF_CLASS}`}
        disabled={isPending}
        aria-pressed={marked}
        aria-label={marked ? unmarkLabel : markLabel}
        onClick={toggle}
      >
        {text}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

export function AutoDraftToggle({ vacancyId, marked }: { vacancyId: number; marked: boolean }) {
  return (
    <MarkToggle
      marked={marked}
      text="Auto-draft"
      markLabel="Mark for auto-draft"
      unmarkLabel="Unmark auto-draft"
      write={() => toggleAutoDraft(vacancyId, marked)}
    />
  );
}

export function PilotToggle({ vacancyId, marked }: { vacancyId: number; marked: boolean }) {
  return (
    <MarkToggle
      marked={marked}
      text="Pilot"
      markLabel="Mark as pilot"
      unmarkLabel="Unmark pilot"
      write={() => togglePilot(vacancyId, marked)}
    />
  );
}
