// src/app/VacancyActions.tsx
"use client";

import { useState } from "react";
import { apply, editAppliedDate, ignore, undo } from "./actions";
import { IGNORE_REASONS, REASON_LABELS } from "@/lib/vacancyActions/validation";
import { SAFE_ERROR_MESSAGE } from "@/lib/vacancyActions/errors";
import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

type VacancyRowStatus = "todo" | "applied" | "ignored";
type ActionResult = { ok: true } | { ok: false; error: string };

const GHOST_CLASS =
  "whitespace-nowrap rounded-full border border-border-control bg-surface-control px-3 py-1 text-sm text-text-primary transition-colors hover:border-border-control-hover hover:bg-surface-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
const FILLED_CLASS =
  "whitespace-nowrap rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
const SELECT_CLASS =
  "appearance-none whitespace-nowrap rounded-full border border-border-control bg-surface-control bg-[length:10px] bg-[right_0.65rem_center] bg-no-repeat py-1 pr-7 pl-3 text-sm text-text-primary transition-colors hover:border-border-control-hover hover:bg-surface-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";
const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23f4f4f6' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
};

export function VacancyActions({
  vacancyId,
  status,
  appliedOn = null,
}: {
  vacancyId: number;
  status: VacancyRowStatus;
  appliedOn?: string | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonValue, setReasonValue] = useState<IgnoreReason | "">("");
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(appliedOn ?? "");

  async function run(action: () => Promise<ActionResult>) {
    setIsPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError(SAFE_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  async function handleReasonChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const reason = event.target.value as IgnoreReason | "";
    setReasonValue(reason);
    if (reason) {
      await run(() => ignore(vacancyId, reason));
      setReasonValue("");
    }
  }

  function openDateEditor() {
    setDateValue(appliedOn ?? "");
    setError(null);
    setIsEditingDate(true);
  }

  function cancelDateEdit() {
    setDateValue(appliedOn ?? "");
    setError(null);
    setIsEditingDate(false);
  }

  async function handleSaveDate() {
    setIsPending(true);
    setError(null);
    try {
      const result = await editAppliedDate(vacancyId, dateValue);
      if (!result.ok) {
        setError(SAFE_ERROR_MESSAGE);
        return;
      }
      setIsEditingDate(false);
    } catch {
      setError(SAFE_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {isEditingDate ? (
          <>
            <input
              type="date"
              aria-label="Applied on"
              className={GHOST_CLASS}
              value={dateValue}
              max={getKlDateString()}
              disabled={isPending}
              onChange={(event) => setDateValue(event.target.value)}
            />
            <button
              type="button"
              className={GHOST_CLASS}
              disabled={isPending || dateValue === appliedOn}
              onClick={handleSaveDate}
            >
              Save
            </button>
            <button
              type="button"
              className={GHOST_CLASS}
              disabled={isPending}
              onClick={cancelDateEdit}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {status === "todo" && (
              <button
                type="button"
                className={FILLED_CLASS}
                disabled={isPending}
                onClick={() => run(() => apply(vacancyId))}
              >
                Applied
              </button>
            )}

            {(status === "todo" || status === "applied") && (
              <>
                <button
                  type="button"
                  className={GHOST_CLASS}
                  disabled={isPending}
                  onClick={() => run(() => ignore(vacancyId))}
                >
                  Ignore
                </button>
                <select
                  aria-label="Ignore with reason"
                  className={SELECT_CLASS}
                  style={SELECT_CHEVRON}
                  disabled={isPending}
                  value={reasonValue}
                  onChange={handleReasonChange}
                >
                  <option value="">Ignore with reason</option>
                  {IGNORE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </>
            )}

            {(status === "applied" || status === "ignored") && (
              <button
                type="button"
                className={GHOST_CLASS}
                disabled={isPending}
                onClick={() => run(() => undo(vacancyId))}
              >
                Undo
              </button>
            )}

            {status === "applied" && (
              <button
                type="button"
                className={GHOST_CLASS}
                disabled={isPending}
                onClick={openDateEditor}
              >
                Edit date
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
