// src/app/VacancyActions.tsx
"use client";

import { useState } from "react";
import { apply, ignore, undo } from "./actions";
import { IGNORE_REASONS, REASON_LABELS } from "@/lib/vacancyActions/validation";
import { SAFE_ERROR_MESSAGE } from "@/lib/vacancyActions/errors";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

type VacancyRowStatus = "todo" | "applied" | "ignored";
type ActionResult = { ok: true } | { ok: false; error: string };

export function VacancyActions({
  vacancyId,
  status,
}: {
  vacancyId: number;
  status: VacancyRowStatus;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handleReasonChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const reason = event.target.value as IgnoreReason | "";
    event.target.value = "";
    if (reason) {
      run(() => ignore(vacancyId, reason));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {status === "todo" && (
          <button type="button" disabled={isPending} onClick={() => run(() => apply(vacancyId))}>
            Applied
          </button>
        )}

        {(status === "todo" || status === "applied") && (
          <>
            <button type="button" disabled={isPending} onClick={() => run(() => ignore(vacancyId))}>
              Ignore
            </button>
            <select
              aria-label="Ignore with reason"
              disabled={isPending}
              value=""
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
          <button type="button" disabled={isPending} onClick={() => run(() => undo(vacancyId))}>
            Undo
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
