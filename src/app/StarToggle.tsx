// src/app/StarToggle.tsx
"use client";

import { useLayoutEffect, useState } from "react";
import { star, unstar } from "./actions";
import { SAFE_ERROR_MESSAGE } from "@/lib/vacancyActions/errors";

// Starring/unstarring is the only action that reorders the table (starred
// rows sort first by default), which can relocate the clicked row far from
// the current scroll position. These hold the pre-click scrollY across the
// server round trip so it can be restored once the reordered row lands.
let pendingScrollRestore: number | null = null;

export function scheduleScrollRestore(scrollY: number): void {
  pendingScrollRestore = scrollY;
}

export function consumePendingScrollRestore(): number | null {
  const y = pendingScrollRestore;
  pendingScrollRestore = null;
  return y;
}

const STAR_BUTTON_CLASS =
  "inline-flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
const STATIC_STAR_CLASS = "inline-flex h-6 w-6 items-center justify-center text-accent";

function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path
        d="M8 1.5l2.07 4.2 4.63.67-3.35 3.27.79 4.61L8 12.1l-4.14 2.15.79-4.61L1.3 6.37l4.63-.67L8 1.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// `interactive` is decided by the caller: a To do row, or any row on the
// Interest tab (where unstarring is always available regardless of status).
// Every other non-todo row only ever shows the static indicator.
export function StarToggle({
  vacancyId,
  starred,
  interactive,
}: {
  vacancyId: number;
  starred: boolean;
  interactive: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Runs after every commit (not just this row's): the row that gets
  // reordered by a star/unstar may not be the one whose instance survives
  // (e.g. unstarring on the Interest tab removes the row entirely), so any
  // still-mounted StarToggle can pick up the pending restore.
  useLayoutEffect(() => {
    const y = consumePendingScrollRestore();
    if (y !== null) {
      window.scrollTo(0, y);
    }
  });

  async function toggle() {
    const scrollY = window.scrollY;
    setIsPending(true);
    setError(null);
    try {
      const result = await (starred ? unstar(vacancyId) : star(vacancyId));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      scheduleScrollRestore(scrollY);
    } catch {
      setError(SAFE_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  if (!interactive) {
    if (!starred) {
      return null;
    }
    return (
      <span className={STATIC_STAR_CLASS} aria-label="Starred">
        <StarGlyph filled />
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={STAR_BUTTON_CLASS}
        disabled={isPending}
        aria-pressed={starred}
        aria-label={starred ? "Unstar" : "Star"}
        onClick={toggle}
      >
        <StarGlyph filled={starred} />
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
