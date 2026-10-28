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
// Same footprint as the star button so the icon column is as narrow as Star.
const ICON_CLASS =
  "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";

type ToggleResult = { ok: true } | { ok: false; error: string };

function MarkToggle({
  marked,
  children,
  className,
  markLabel,
  unmarkLabel,
  write,
}: {
  marked: boolean;
  children: React.ReactNode;
  className: string;
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
        className={className}
        disabled={isPending}
        aria-pressed={marked}
        aria-label={marked ? unmarkLabel : markLabel}
        title={marked ? unmarkLabel : markLabel}
        onClick={toggle}
      >
        {children}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

function BoltGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      <path d="M9 1.5L3 9h4l-1 5.5L13 7H9l0-5.5z" />
    </svg>
  );
}

export function AutoDraftToggle({ vacancyId, marked }: { vacancyId: number; marked: boolean }) {
  return (
    <MarkToggle
      marked={marked}
      className={`${ICON_CLASS} ${marked ? "text-accent" : "text-text-secondary"}`}
      markLabel="Mark for auto-draft"
      unmarkLabel="Unmark auto-draft"
      write={() => toggleAutoDraft(vacancyId, marked)}
    >
      <BoltGlyph filled={marked} />
    </MarkToggle>
  );
}

export function PilotToggle({ vacancyId, marked }: { vacancyId: number; marked: boolean }) {
  return (
    <MarkToggle
      marked={marked}
      className={`${TOGGLE_CLASS} ${marked ? ON_CLASS : OFF_CLASS}`}
      markLabel="Mark as pilot"
      unmarkLabel="Unmark pilot"
      write={() => togglePilot(vacancyId, marked)}
    >
      Pilot
    </MarkToggle>
  );
}
