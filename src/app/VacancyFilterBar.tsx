"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { FormEvent, MouseEvent } from "react";
import { buildVacancyHref, type VacancyHrefParams } from "@/lib/vacancyActions/vacancyLinks";
import { statusFilterAppliesToView, STATUS_LABELS, type VacancyStatusFilter } from "@/lib/vacancyActions/vacancyTabs";

const STATUS_OPTIONS: VacancyStatusFilter[] = ["todo", "applied", "ignored"];
const inputClass =
  "rounded-sm border border-border-subtle bg-surface-row px-2 py-1 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const buttonClass =
  "rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const ghostLinkClass =
  "rounded-full border border-border-subtle px-4 py-1.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function disableEmptyFields(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) continue;
    if (element.type === "hidden" || element.type === "submit") continue;
    if (element.value === "") element.disabled = true;
  }
}

function reenableFields(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.disabled = false;
    }
  }
}

// Disable (rather than clear) empty fields right before the native GET
// submit fires, so the browser excludes them from the query string.
function handleSubmit(event: FormEvent<HTMLFormElement>) {
  disableEmptyFields(event.currentTarget);
}

// A click anywhere in the field opens the native date picker, so it's
// discoverable without requiring the user to hit the small calendar icon.
// Typing still works once the field is focused.
function handleDateClick(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Picker unavailable in this browser/context (e.g. not a user gesture); typing still works.
  }
}

export function VacancyFilterBar({
  view,
  reasonFilter,
  q,
  company,
  from,
  to,
  status,
  companies,
  hasActiveFilters,
  sort,
  dir,
}: VacancyHrefParams & { companies: string[]; hasActiveFilters: boolean }) {
  // Keying the form on the current filter values forces React to remount
  // it (and its uncontrolled inputs) whenever they change via in-page
  // navigation, instead of leaving stale defaultValue-initialized DOM nodes
  // in place.
  const formKey = JSON.stringify([view, reasonFilter, q, company, from, to, status]);

  const formRef = useRef<HTMLFormElement>(null);

  // Fields disabled by handleSubmit stay disabled if the browser restores
  // this page from the back/forward cache instead of re-rendering it, so
  // re-enable them whenever that happens.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      const form = formRef.current;
      if (form) reenableFields(form);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <form
      key={formKey}
      ref={formRef}
      method="get"
      action="/"
      onSubmit={handleSubmit}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border-subtle bg-surface-panel p-4 text-sm"
    >
      <input type="hidden" name="view" value={view} />
      {reasonFilter && <input type="hidden" name="reason" value={reasonFilter} />}
      {sort && dir && (
        <>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
        </>
      )}

      <label className="flex flex-col gap-1 text-text-secondary">
        Search
        <input type="text" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-text-secondary">
        Company
        <select name="company" defaultValue={company ?? ""} className={inputClass}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-text-secondary">
        From
        <input
          type="date"
          name="from"
          defaultValue={from ?? ""}
          onClick={handleDateClick}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-text-secondary">
        To
        <input
          type="date"
          name="to"
          defaultValue={to ?? ""}
          onClick={handleDateClick}
          className={inputClass}
        />
      </label>

      {statusFilterAppliesToView(view) && (
        <label className="flex flex-col gap-1 text-text-secondary">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className={buttonClass}>
        Search
      </button>

      {hasActiveFilters && (
        <Link href={buildVacancyHref({ view, reasonFilter, sort, dir })} className={ghostLinkClass}>
          Clear filters
        </Link>
      )}
    </form>
  );
}
