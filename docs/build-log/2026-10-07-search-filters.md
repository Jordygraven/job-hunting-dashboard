# Epic 5: Search and Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (native execution in this session, no subagents except one final whole-branch reviewer).

**Goal:** Harden `fetchAllRows`'s pagination (cap-independence + race fix), and add server-side search/filters (q, company, date range, status) across every vacancy tab.

**Architecture:** Task 1 replaces offset (`.range()`) pagination with cursor/keyset pagination in `fetchAllRows`, so correctness no longer depends on knowing Supabase's real row cap and a concurrent insert can't shift page boundaries. Task 2 adds a small `vacancyFilters.ts` module (universal filters: q/company/date range) alongside the existing `vacancyTabs.ts` (view-dependent filters: reason/status), both applied in-memory in `getVacancyTabData` after all rows are loaded. A shared `vacancyLinks.ts` builds every filter-preserving URL.

**Tech Stack:** Next.js App Router (server components, plain GET forms), Vitest, Supabase (PostgREST query builder, mocked in tests).

**Spec:** This plan file — the user's Epic 5 prompt (search/filter rules) and `BACKLOG.md`'s "Step 2 (triage UI) — 7 Oct" section (data-layer bugs) are the spec; no separate doc exists.

## Global Constraints

- Filtering happens in code after loading all rows, never in the Supabase query.
- All new filters combine with AND, together with the existing `reason` filter.
- `q`: trim, case-insensitive, partial match on title/company/location, cap 100 chars.
- `company`: exact match on stored company name.
- `from`/`to`: `YYYY-MM-DD`, inclusive, compared as Asia/Kuala_Lumpur calendar days.
- `status` (`todo`/`applied`/`ignored`): only applied/shown on the All tab.
- Invalid param values are ignored (treated as absent), matching today's unknown-param handling.
- Tab counts reflect `q`/`company`/`from`/`to` only, never `status`/`reason`.
- `show` resets to the default (10) whenever the filter form is submitted.
- Never read/print `.env.local` values. No schema-changing SQL (none needed here).
- One concern per commit; delete each fixed BACKLOG line in the commit that fixes it.
- If `fetchAllRows`'s iteration guard trips, it must throw — never return the partial list collected so far. A thrown error surfaces as a loud failure; a silently short list would quietly undercount every vacancy and every tab count.
- The company dropdown's options come from `allRows` (every vacancy, unfiltered) — never from `commonFilteredRows` or the current tab's rows. Narrowing it to the filtered set would hide companies the moment any filter is active, making them impossible to select back.

## Review Focus

- A `from` date after `to` must yield zero rows, not an error or an unfiltered list.
- A vacancy with `location: null` must still be searchable by title/company, and a query shouldn't crash on the null.
- `q` longer than 100 characters must be truncated, not rejected outright (param stays "valid", just capped).
- Switching tabs away from "All" must drop `status` from the URL even though `q`/`company`/`from`/`to`/`show` carry over.
- A real Supabase row cap lower than the page-size hint must not cause silent undercounting (this is the whole point of Task 1's `fetchAllRows` test).
- `fetchAllRows`'s iteration guard tripping must throw, not return the rows collected so far — a partial list would silently undercount vacancies and every tab count downstream.

---

## Task 1: Harden the data layer

**Files:**
- Modify: `src/lib/supabase/fetchAllRows.ts`
- Modify: `src/lib/supabase/fetchAllRows.test.ts`
- Modify: `src/lib/vacancies/getVacancies.ts`
- Modify: `src/lib/vacancies/getVacancies.test.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.test.ts`
- Modify: `BACKLOG.md` (delete the two fixed lines, split across the two commits below)

**Design:** Replace offset pagination with keyset/cursor pagination. `fetchAllRows` no longer takes `(from, to)` — it takes `(after: T | null) => Promise<{data, error}>` and keeps calling with `after` set to the last row of the previous page, stopping only on an **empty** page (never on "page shorter than N"). This removes the dependency on `SUPABASE_MAX_ROWS` matching the real server cap, and removes the offset-vs-concurrent-insert race, because each page is anchored to the last row actually seen, not a numeric position. An iteration ceiling guards a backend that never returns an empty page (e.g. ignores the cursor filter).

```ts
// src/lib/supabase/fetchAllRows.ts
import "server-only";

export const SUPABASE_MAX_ROWS = 1000; // page-size hint for callers' `.limit()`; NOT assumed to be the real server cap
export const FETCH_ALL_ROWS_MAX_PAGES = 100_000; // guards a backend that never returns an empty page

export async function fetchAllRows<T>(
  fetchPage: (after: T | null) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  maxPages: number = FETCH_ALL_ROWS_MAX_PAGES
): Promise<T[]> {
  const rows: T[] = [];
  let after: T | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await fetchPage(after);

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      return rows;
    }

    rows.push(...data);
    after = data[data.length - 1];
  }

  throw new Error(`fetchAllRows: exceeded ${maxPages} pages without an empty page`);
}
```

Callers build their own cursor filter from `after`, since only they know the sort columns:

```ts
// src/lib/vacancies/getVacancies.ts — compound order (first_seen_at desc, id desc)
const rows = await fetchAllRows<VacancyRow>(async (after) => {
  let query = supabase
    .from("vacancies")
    .select("id, title, company, location, url, first_seen_at")
    .order("first_seen_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SUPABASE_MAX_ROWS);

  if (after) {
    query = query.or(
      `first_seen_at.lt.${after.first_seen_at},and(first_seen_at.eq.${after.first_seen_at},id.lt.${after.id})`
    );
  }
  return query;
});
```

```ts
// src/lib/vacancyActions/getVacancyStatuses.ts — single-column order (id desc)
const rows = await fetchAllRows<VacancyActionDbRow>(async (after) => {
  let query = supabase
    .from("vacancy_actions")
    .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
    .order("id", { ascending: false })
    .limit(SUPABASE_MAX_ROWS);

  if (after) {
    query = query.lt("id", after.id);
  }
  return query;
});
```

Test-mock shape changes from `.order().range()` to `.order().limit()` with an optional `.lt()`/`.or()`, where `.limit()` returns a thenable "builder" object so both `await query.limit(N)` and `await query.limit(N).lt(...)` work:

```ts
function makeTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const cursorMock = vi.fn();
  function builder(): any {
    const b: any = {
      lt: (...args: any[]) => { cursorMock(...args); return b; },
      or: (...args: any[]) => { cursorMock(...args); return b; },
    };
    b.then = (resolve: any, reject: any) =>
      Promise.resolve(pages[Math.min(call++, pages.length - 1)]).then(resolve, reject);
    return b;
  }
  const limitMock = vi.fn(() => builder());
  const orderMock = vi.fn(() => ({ order: orderMock, limit: limitMock })); // chainable for 2 .order() calls
  return { table: { select: () => ({ order: orderMock }) }, limitMock, orderMock, cursorMock };
}
```

- [ ] **Step 1: Rewrite `fetchAllRows` to cursor-based pagination** (code above), update `fetchAllRows.test.ts`:
  - "returns everything from a single page, in one request" (no `after` passed on to `fetchPage`)
  - "keeps paging until an empty page ends it" (multi-page, asserts `after` passed to call *n* is the last row of call *n-1*)
  - **New:** "keeps paging even when the real cap is lower than the requested page size" — mock `fetchPage` that ignores any notion of `SUPABASE_MAX_ROWS` and always returns at most 3 rows from a 7-row fixture based on the `after` cursor; assert all 7 rows come back across 4 calls (3+3+1+empty). This is the BACKLOG test showing cap-independence.
  - "throws a plain Error with the DB message when a page errors" (unchanged behavior)
  - **New:** "throws after exceeding the page-count guard" — pass a small `maxPages` override (e.g. 5) to a `fetchPage` that always resolves non-empty; assert it throws after exactly 5 calls.
  - Run `npm test -- fetchAllRows`, confirm green.
  - Commit: `git add src/lib/supabase/fetchAllRows.ts src/lib/supabase/fetchAllRows.test.ts BACKLOG.md` — delete the BACKLOG line "Task 2 (pagination fix): fetchAllRows's stop condition assumes..." — commit message like "Make fetchAllRows cursor-based so it no longer assumes Supabase's row cap".

- [ ] **Step 2: Switch `getVacancies.ts` to cursor pagination** (code above). Update `getVacancies.test.ts`'s mock to the new `.order().order().limit()` + optional `.or()` shape; keep the existing mapping/ordering/error tests; update the "keeps paging past a full page" test to assert the `.or()` cursor call instead of `.range()` offsets.
  - **New:** "pages by a cursor on the last row, not a numeric offset — so a row inserted between page requests can't be skipped or double-counted": two-page fixture, assert `cursorMock` (the `.or()` call) is invoked with a filter string referencing the **last row's** `first_seen_at`/`id` from page 1, not an offset number.
  - Run `npm test -- getVacancies`, confirm green.
  - Commit: delete the BACKLOG line "Task 2 (pagination fix): offset pagination via .range() can skip or double-count..." (half of it — this file's half) — commit message like "Page getVacancies by cursor, not offset, to fix the insert race".

- [ ] **Step 3: Switch `getVacancyStatuses.ts` to cursor pagination** (code above). Update `getVacancyStatuses.test.ts`'s mock the same way; keep existing grouping/dedup/error tests; update the "keeps paging past a full page" test to assert `.lt("id", ...)` instead of `.range()` offsets.
  - **New:** same cursor-not-offset regression test as Step 2, adapted to the single-column `id` cursor.
  - Run `npm test -- getVacancyStatuses`, confirm green.
  - Commit: remove the now-fully-deleted BACKLOG line (both files done) — commit message like "Page getVacancyStatuses by cursor, not offset, to fix the insert race".

---

## Task 2: Search and filters on every tab

**Files:**
- Create: `src/lib/vacancyActions/vacancyFilters.ts`
- Create: `src/lib/vacancyActions/vacancyFilters.test.ts`
- Create: `src/lib/vacancyActions/vacancyLinks.ts`
- Create: `src/lib/vacancyActions/vacancyLinks.test.ts`
- Create: `src/app/VacancyFilterBar.tsx`
- Create: `src/app/VacancyFilterBar.test.tsx`
- Modify: `src/lib/vacancyActions/vacancyTabs.ts` (add `resolveStatusFilter`, `VacancyStatusFilter`, export `STATUS_LABELS`, export `firstOf`)
- Modify: `src/lib/vacancyActions/vacancyTabs.test.ts`
- Modify: `src/lib/vacancyActions/getVacancyTabData.ts`
- Modify: `src/lib/vacancyActions/getVacancyTabData.test.ts`
- Modify: `src/app/VacancyTabs.tsx` (use `buildVacancyHref`, thread q/company/from/to/status)
- Modify: `src/app/VacancyTabs.test.tsx`
- Modify: `src/app/VacancyPagination.tsx` (use `buildVacancyHref`)
- Modify: `src/app/VacancyPagination.test.tsx`
- Modify: `src/app/VacancyTable.tsx` (import shared `STATUS_LABELS`; "No vacancies match" + Clear filters empty state)
- Modify: `src/app/VacancyTable.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `vacancyFilters.ts` produces: `VacancyFilters = { q: string|null; company: string|null; from: string|null; to: string|null }`, `resolveVacancyFilters(params): VacancyFilters`, `matchesVacancyFilters(row: VacancyTabRow, filters: VacancyFilters): boolean`, `distinctCompaniesSorted(rows: {company: string}[]): string[]`.
- `vacancyTabs.ts` adds: `VacancyStatusFilter = VacancyTabRow["status"]`, `resolveStatusFilter(view, value): VacancyStatusFilter | null`, `STATUS_LABELS: Record<VacancyTabRow["status"], string>`, `firstOf` (exported, was private).
- `vacancyLinks.ts` produces: `buildVacancyHref(params: { view; reasonFilter?; status?; show?; q?; company?; from?; to? }): string`.
- `getVacancyTabData` now returns additionally: `statusFilter`, `q`, `company`, `from`, `to`, `companies: string[]`, `hasActiveFilters: boolean`.

### Step-by-step

- [ ] **Step 1: `vacancyFilters.ts` — parsing/validation + matching, test-first**

```ts
// src/lib/vacancyActions/vacancyFilters.ts
import { isValidDateString } from "@/lib/format/kualaLumpurDate";
import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import { firstOf, type VacancyTabRow } from "./vacancyTabs";

const MAX_QUERY_LENGTH = 100;

export type VacancyFilters = {
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
};

function resolveSearchQuery(value: string | string[] | undefined): string | null {
  const trimmed = firstOf(value)?.trim();
  return trimmed ? trimmed.slice(0, MAX_QUERY_LENGTH).toLowerCase() : null;
}

function resolveCompany(value: string | string[] | undefined): string | null {
  const trimmed = firstOf(value)?.trim();
  return trimmed ? trimmed : null;
}

function resolveDateParam(value: string | string[] | undefined): string | null {
  const candidate = firstOf(value);
  return candidate !== undefined && isValidDateString(candidate) ? candidate : null;
}

export function resolveVacancyFilters(params: {
  q?: string | string[];
  company?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): VacancyFilters {
  return {
    q: resolveSearchQuery(params.q),
    company: resolveCompany(params.company),
    from: resolveDateParam(params.from),
    to: resolveDateParam(params.to),
  };
}

function matchesSearch(row: VacancyTabRow, q: string | null): boolean {
  if (q === null) return true;
  return [row.title, row.company, row.location ?? ""].some((field) =>
    field.toLowerCase().includes(q)
  );
}

export function matchesVacancyFilters(row: VacancyTabRow, filters: VacancyFilters): boolean {
  if (!matchesSearch(row, filters.q)) {
    return false;
  }
  if (filters.company && row.company !== filters.company) {
    return false;
  }
  if (filters.from || filters.to) {
    const klDate = getKlDateString(new Date(row.firstSeenAt));
    if (filters.from && klDate < filters.from) return false;
    if (filters.to && klDate > filters.to) return false;
  }
  return true;
}

export function distinctCompaniesSorted(rows: { company: string }[]): string[] {
  return Array.from(new Set(rows.map((r) => r.company))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
```

  Tests in `vacancyFilters.test.ts` (plain functions, no live calls):
  - `resolveVacancyFilters`: trims/lowercases `q`, caps at 100 chars, empty/whitespace-only → `null`; `company` trims, empty → `null`; `from`/`to` accept valid `YYYY-MM-DD`, reject malformed strings (`null`), reject non-existent calendar dates like `2026-02-30`.
  - `matchesVacancyFilters`: matches on title/company/location independently (not a concatenated string — e.g. title ending "foo" + company starting "bar" must NOT match query "ooba"); `location: null` treated as empty, doesn't crash, doesn't false-match; company exact match (case-sensitive); date range inclusive on both boundaries using a UTC timestamp that crosses a KL calendar-day boundary (e.g. `2026-10-01T20:00:00.000Z` → KL date `2026-10-02`); `from` after `to` → every row fails (empty result) even when data would match either bound alone; no filters set → everything matches.
  - `distinctCompaniesSorted`: dedupes, sorts A→Z case-insensitively (e.g. `["acme", "Beta", "amp"]` → `["acme", "amp", "Beta"]`).

  Run `npm test -- vacancyFilters`, confirm green. Commit.

- [ ] **Step 2: `vacancyTabs.ts` — add `resolveStatusFilter`, export `STATUS_LABELS`/`firstOf`, test-first**

  Add to `vacancyTabs.ts`:
  ```ts
  export function firstOf(value: string | string[] | undefined): string | undefined { ... } // was private, now exported
  export type VacancyStatusFilter = VacancyTabRow["status"];
  const STATUS_FILTERS: readonly VacancyStatusFilter[] = ["todo", "applied", "ignored"];
  export function resolveStatusFilter(view: VacancyTabView, value: string | string[] | undefined): VacancyStatusFilter | null {
    if (view !== "all") return null;
    const candidate = firstOf(value);
    return candidate !== undefined && (STATUS_FILTERS as readonly string[]).includes(candidate)
      ? (candidate as VacancyStatusFilter)
      : null;
  }
  export const STATUS_LABELS: Record<VacancyTabRow["status"], string> = {
    todo: "To do",
    applied: "Applied",
    ignored: "Ignored",
  };
  ```
  Tests in `vacancyTabs.test.ts`: `resolveStatusFilter` returns `null` on every view except `"all"` even with a valid value; on `"all"`, returns the value for `"todo"`/`"applied"`/`"ignored"`, `null` for an unknown value or when absent.

  Run `npm test -- vacancyTabs`, confirm green. Commit.

- [ ] **Step 3: `vacancyLinks.ts` — shared href builder, test-first**

```ts
// src/lib/vacancyActions/vacancyLinks.ts
import type { IgnoreReason } from "./types";
import type { ShowParam, VacancyStatusFilter, VacancyTabView } from "./vacancyTabs";

export type VacancyHrefParams = {
  view: VacancyTabView;
  reasonFilter?: IgnoreReason | "none" | null;
  status?: VacancyStatusFilter | null;
  show?: ShowParam;
  q?: string | null;
  company?: string | null;
  from?: string | null;
  to?: string | null;
};

export function buildVacancyHref(params: VacancyHrefParams): string {
  const sp = new URLSearchParams({ view: params.view });
  if (params.reasonFilter) sp.set("reason", params.reasonFilter);
  if (params.view === "all" && params.status) sp.set("status", params.status);
  if (params.show && params.show !== 10) sp.set("show", String(params.show));
  if (params.q) sp.set("q", params.q);
  if (params.company) sp.set("company", params.company);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  return `/?${sp.toString()}`;
}
```

  Tests in `vacancyLinks.test.ts`: bare `{view: "todo"}` → `/?view=todo`; every optional field appends correctly; `status` is dropped when `view !== "all"` even if passed; `show: 10` (default) is omitted, `show: 20`/`"all"` included; empty-string/`null` values for q/company/from/to are omitted, not rendered as `q=`.

  Run `npm test -- vacancyLinks`, confirm green. Commit.

- [ ] **Step 4: Wire filters into `getVacancyTabData.ts`, test-first**

```ts
// src/lib/vacancyActions/getVacancyTabData.ts (changed parts)
export type VacancyTabSearchParams = {
  view?: string | string[];
  reason?: string | string[];
  show?: string | string[];
  q?: string | string[];
  company?: string | string[];
  from?: string | string[];
  to?: string | string[];
  status?: string | string[];
};

export type VacancyTabData = {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  statusFilter: VacancyStatusFilter | null;
  counts: VacancyTabCounts;
  rows: VacancyTabRow[];
  show: ShowParam;
  filteredCount: number;
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
  companies: string[];
  hasActiveFilters: boolean;
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, statuses] = await Promise.all([getVacancies(), getVacancyStatuses()]);
  const allRows = vacancies.map((v) => buildVacancyTabRow(v, statuses.get(v.id) ?? { status: "todo" }));

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);
  const statusFilter = resolveStatusFilter(view, params.status);
  const show = resolveShow(params.show);
  const filters = resolveVacancyFilters(params);

  const commonFilteredRows = allRows.filter((row) => matchesVacancyFilters(row, filters));
  const counts = countByView(commonFilteredRows);

  let filteredRows = selectRowsForView(commonFilteredRows, view, reasonFilter);
  if (statusFilter) {
    filteredRows = filteredRows.filter((row) => row.status === statusFilter);
  }

  return {
    view,
    reasonFilter,
    statusFilter,
    show,
    q: filters.q,
    company: filters.company,
    from: filters.from,
    to: filters.to,
    companies: distinctCompaniesSorted(allRows),
    counts,
    rows: sliceRowsForShow(filteredRows, show),
    filteredCount: filteredRows.length,
    hasActiveFilters: Boolean(filters.q || filters.company || filters.from || filters.to || statusFilter),
  };
}
```

  Tests to add in `getVacancyTabData.test.ts` (reuse the existing `VACANCIES` fixture and its `beforeEach` mocks):
  - `q` narrows rows on every tab (test on `view: "all"`), partial/case-insensitive.
  - `company` exact-match narrows rows; non-existent company → zero rows, not an error.
  - `from`/`to` narrow by the KL calendar day of `firstSeenAt`; `from` after `to` → zero rows.
  - **Counts add up with filters active:** apply `company` + `view: "ignored"` + `reason`; assert `counts` reflects the company filter (not the reason filter) and `counts.todo + counts.applied + counts.ignored === counts.all`.
  - `status` only narrows rows when `view: "all"`; passing `status` with `view: "todo"` has no effect.
  - `companies` lists every distinct company across all rows regardless of active filters (sorted).
  - `hasActiveFilters` is `false` with no params, `true` with any one of q/company/from/to/status set.

  Run `npm test -- getVacancyTabData`, confirm green. Commit.

- [ ] **Step 5: Filter bar UI — `VacancyFilterBar.tsx`, test-first**

```tsx
// src/app/VacancyFilterBar.tsx
import Link from "next/link";
import type { IgnoreReason } from "@/lib/vacancyActions/types";
import { STATUS_LABELS, type VacancyStatusFilter, type VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import { buildVacancyHref } from "@/lib/vacancyActions/vacancyLinks";

const STATUS_OPTIONS: VacancyStatusFilter[] = ["todo", "applied", "ignored"];
const inputClass = "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";

export function VacancyFilterBar({
  view, reasonFilter, q, company, from, to, status, companies, hasActiveFilters,
}: {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  q: string | null;
  company: string | null;
  from: string | null;
  to: string | null;
  status: VacancyStatusFilter | null;
  companies: string[];
  hasActiveFilters: boolean;
}) {
  return (
    <form method="get" action="/" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="view" value={view} />
      {reasonFilter && <input type="hidden" name="reason" value={reasonFilter} />}

      <label className="flex flex-col gap-1">
        Search
        <input type="text" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        Company
        <select name="company" defaultValue={company ?? ""} className={inputClass}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        From
        <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1">
        To
        <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
      </label>

      {view === "all" && (
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
        Search
      </button>

      {hasActiveFilters && (
        <Link href={buildVacancyHref({ view, reasonFilter })} className="underline">
          Clear filters
        </Link>
      )}
    </form>
  );
}
```

  Tests in `VacancyFilterBar.test.tsx` (jsdom, `@testing-library/react`, `afterEach(() => cleanup())`):
  - renders prefilled values from props (`q`, `company` select, `from`, `to`).
  - status dropdown only renders when `view === "all"`.
  - "Clear filters" link only renders when `hasActiveFilters` is true, and its `href` has no q/company/from/to/status.
  - form's `method` is `get` and hidden `view`/`reason` inputs are present.

  Run `npm test -- VacancyFilterBar`, confirm green. Commit.

- [ ] **Step 6: Thread filters through `VacancyTabs.tsx` and `VacancyPagination.tsx` links**

  Replace the local `tabHref`/`reasonHref` in `VacancyTabs.tsx` and `moreHref` in `VacancyPagination.tsx` with calls to `buildVacancyHref`, adding `status`, `q`, `company`, `from`, `to` props to both components (passed straight through from `page.tsx`). Tab links pass `{view: tab.view, status, show, q, company, from, to}` (no `reasonFilter` — matches today's behavior of not carrying reason on tab links). Reason links pass `{view: "ignored", reasonFilter: value, show, q, company, from, to}`. `moreHref` passes `{view, reasonFilter, status, show: target, q, company, from, to}`.

  Update `VacancyTabs.test.tsx` and `VacancyPagination.test.tsx`: existing assertions on hrefs like `/?view=applied` still pass (new optional props default to `null`/absent, adding nothing); add new cases asserting `q`/`company`/`from`/`to` appear on tab/reason/more links when set, and that `status` is absent from a non-"all" tab link even when a `status` prop is passed.

  Run `npm test -- VacancyTabs VacancyPagination`, confirm green. Commit.

- [ ] **Step 7: Empty-state + wiring in `VacancyTable.tsx` and `page.tsx`**

  `VacancyTable.tsx`: import `STATUS_LABELS` from `vacancyTabs.ts` instead of its own local `STATUS_LABELS` constant; add `hasActiveFilters: boolean` and `clearFiltersHref: string` props; when `rows.length === 0 && hasActiveFilters`, render "No vacancies match." plus a `Link` to `clearFiltersHref` instead of the per-tab `EMPTY_STATE_TEXT`.

  Update `VacancyTable.test.tsx`: new case asserting the "No vacancies match" + Clear filters link renders when `hasActiveFilters` is true and `rows` is empty, and that the original per-tab empty text still renders when `hasActiveFilters` is false.

  `page.tsx`: import and render `<VacancyFilterBar>` above `<VacancyTabs>`, pass `statusFilter`/`q`/`company`/`from`/`to`/`companies`/`hasActiveFilters` down to `VacancyFilterBar`, `VacancyTabs`, `VacancyTable`, `VacancyPagination` as designed above; compute `clearFiltersHref = buildVacancyHref({ view, reasonFilter })` once and pass to both `VacancyFilterBar`... (already computes its own, so just pass to `VacancyTable`).

  No automated test for `page.tsx` itself (matches existing repo convention — it has none). Manually verify once on `npm run dev` and again on the Preview deploy per `CLAUDE.md`.

  Run full `npm test`, confirm green. Commit.

---

## Finish

- [ ] `npm test`, `npm run lint`, `npm run build` all pass. Report the final test count.
- [ ] Final whole-branch review: one subagent, reviewing the full diff against `main`. Cross-check any Minor finding against this plan's Global Constraints/design decisions before acting on it (e.g. the cursor-pagination redesign and the per-field — not concatenated — search match are deliberate).
- [ ] Push the branch (`epic-5-search-filters`) and stop. User does the Preview test and opens the PR.
