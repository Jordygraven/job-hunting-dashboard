# Vacancy Triage UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the triage UI — four tabs (To do / Applied / Ignored / All) with counts, a reason filter on the Ignored tab, and Applied/Ignore/Undo buttons — on top of the already-merged `vacancy_actions` data layer, with no database or guard changes.

**Architecture:** The URL is the only state: `?view=` picks the tab, `?reason=` filters the Ignored tab. A new server-only `getVacancyTabData()` composes `getVacancies()` and `getVacancyStatuses()` into per-tab rows and tab counts, built from small pure helpers that are unit-tested directly. Both `getVacancies()` and `getVacancyStatuses()` are hardened in Task 2 to page through their full tables via a shared `fetchAllRows()` helper, so tab counts can never silently undercount once a table exceeds Supabase's default per-request row cap. `src/app/page.tsx` is a thin async data loader; it delegates all rendering to two plain synchronous, props-only components — `VacancyTabs` and `VacancyTable` — which is what the UI tests render directly (never the async page itself). A new client component `VacancyActions` renders the row-level Applied/Ignore/Undo buttons, calling the existing `apply`/`ignore`/`undo` Server Actions directly and showing only safe, already-sanitized messages on failure. Before any UI work, Task 1 hardens the write/read path left over from the data-layer branch (server-only guards, a safe failure path for a missing Supabase client, and the BACKLOG Minors tied to that code).

**Tech Stack:** Next.js (App Router, TypeScript) Server Components + Server Actions, Supabase (mocked in tests), Vitest, `@testing-library/react` + `jsdom` (new, devDependencies only, for the two UI tasks), `server-only` (new runtime dependency).

**Spec:** Full spec given in conversation (no separate spec doc). Key decisions already made by the user in the request:
- Branch `feat/vacancy-triage-ui` is cut from `main` (Step 1 — `feat/vacancy-actions` — is already merged).
- Exactly 4 tasks. Reviewer on Tasks 1, 2, 4. Task 3 is visual-check only by the user. One final whole-branch review after Task 4.
- No database, Server Action guard, or step-1 status-derivation *logic* changes — Task 1's and Task 2's edits are explicitly-scoped hardening (safe-failure path, type narrowing, pagination), not behavior changes for valid data.
- Task 2 must confirm `getVacancies()`/`getVacancyStatuses()` don't silently cap the rows they read, since tab counts must cover every vacancy; if a cap exists, remove it for this path and add a test that fails without the fix.
- `page.tsx` is an async Server Component and must not be rendered in tests; rendering/table logic is split into synchronous, props-driven components for the UI tests to target.
- Out of scope for this branch: search, filters other than the reason filter, "Read more", applied-date edits, sync details.
- Push the branch at the end and stop — no PR.

## Global Constraints

- Never read, print, or log values from `.env.local`; refer to env var names only (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — no task here needs to read `.env.local`.
- Never run schema-changing or destructive SQL. Nothing in this plan touches the database schema.
- Do not change the database, the Server Action guards (the `ok:false` guard-rejection branches in `writeVacancyAction`), or the step-1 status-derivation logic (`deriveVacancyStatus`'s rules for *valid* rows). Use `apply`/`ignore`/`undo`/`editAppliedDate` from `src/app/actions.ts` exactly as they exist.
- One concern per commit; each task below is its own commit.
- Vitest mocks mirror the real Supabase query shape already used in this codebase (`vi.mock("@/lib/supabase/server", ...)` with a `from` dispatch) — no guessed response shapes.
- `npm test` (`vitest run`) must pass after every task, including all pre-existing tests.
- Delete each BACKLOG.md item this branch resolves (see the lists in Task 1, Task 2, and Task 3 below). Add any new Minors a reviewer raises to BACKLOG.md under a new `## Step 2 (triage UI)` heading — don't scope-creep them into a task.
- No search, no filters beyond the reason filter, no "Read more", no applied-date edits, no sync details in this branch.
- `page.tsx` is never rendered in a test (it's an async Server Component); UI tests render `VacancyTabs`/`VacancyTable`/`VacancyActions` directly with plain props.

## Review Focus

- **The `reason` param must only ever affect the Ignored tab.** `/?view=todo&reason=language` must show all to-do rows, not filter them — covered by Task 2's `resolveReasonFilter` tests (view-gating case).
- **A read capped at Supabase/PostgREST's default max-rows (1000 per request)** would silently undercount every tab once a table exceeds that size — covered by Task 2's `fetchAllRows` pagination tests, which fail without the fix.
- **A thrown/rejected `getSupabaseServerClient()` must degrade to a safe `{ok:false}`, not an unhandled rejection the UI can't render.** Covered by Task 1.
- **A rejected Server Action promise in the browser** (not just a `{ok:false}` result — e.g. a transport failure) must render the same generic safe message as a `{ok:false}` result, never a raw `Error.message`, and must re-enable the row's buttons afterward. Covered by Task 4's two error-path tests.
- **A vacancy with `location: null`** must render as an empty cell, not `"null"` or a thrown error. Covered by Task 3 (this is also the BACKLOG Minor this branch resolves).
- **A double-click on the same row** must not fire a second Server Action while the first is still pending — covered by Task 4's pending-disable test.

---

## File Structure

New files:
- `src/lib/supabase/fetchAllRows.ts` — generic server-only pagination helper: pages a Supabase query in chunks of `SUPABASE_MAX_ROWS` until a short page ends it.
- `src/lib/supabase/fetchAllRows.test.ts`.
- `src/lib/vacancies/getVacancies.test.ts` — new; also resolves the pre-existing BACKLOG Minor about this function having no test.
- `src/lib/vacancyActions/vacancyTabs.ts` — pure: tab/reason-filter types, `resolveView`, `resolveReasonFilter`, `buildVacancyTabRow`, `selectRowsForView`, `countByView`.
- `src/lib/vacancyActions/vacancyTabs.test.ts`.
- `src/lib/vacancyActions/getVacancyTabData.ts` — server-only composition: `getVacancies()` + `getVacancyStatuses()` → one tab's rows + all tab counts.
- `src/lib/vacancyActions/getVacancyTabData.test.ts`.
- `src/app/VacancyTabs.tsx` — sync, props-only: the tab links + reason-filter links.
- `src/app/VacancyTabs.test.tsx`.
- `src/app/VacancyTable.tsx` — sync, props-only: the per-tab table + empty state + Actions column.
- `src/app/VacancyTable.test.tsx`.
- `src/app/VacancyActions.tsx` — client component: Applied/Ignore/Undo buttons + "ignore with reason" select, per-row pending/error state.
- `src/app/VacancyActions.test.tsx`.

Modified files:
- `package.json` / `package-lock.json` — add `server-only` (dependency, Task 1); add `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` (devDependencies, added in Task 3).
- `vitest.config.ts` — alias `server-only` to its real no-op `empty.js` entry point so tests don't hit its throwing default export.
- `src/lib/supabase/server.ts` — `import "server-only"`.
- `src/lib/vacancyActions/writeVacancyAction.ts` — `import "server-only"`; catch a throwing `getSupabaseServerClient()`.
- `src/lib/vacancyActions/getVacancyStatuses.ts` — `import "server-only"` (Task 1); refactored onto `fetchAllRows` (Task 2).
- `src/lib/vacancyActions/deriveVacancyStatus.ts` — runtime-safe narrowing instead of `as string`.
- `src/lib/vacancyActions/validation.ts` — type `IGNORE_REASONS` from `IgnoreReason` and export it.
- `src/lib/vacancies/getVacancies.ts` — refactored onto `fetchAllRows` (Task 2).
- `src/lib/vacancyActions/writeVacancyAction.test.ts` — query-argument assertions, no-insert-on-guard-rejection assertions, failing-client test.
- `src/lib/vacancyActions/getVacancyStatuses.test.ts` — query-argument assertions (Task 1); pagination mock shape + new pagination test (Task 2).
- `src/lib/vacancyActions/deriveVacancyStatus.test.ts` — new narrowing-failure test.
- `src/app/actions.test.ts` — add the "no revalidate on failure" test for `undo` and `editAppliedDate`.
- `src/app/page.tsx` — becomes a thin async loader rendering `VacancyTabs` + `VacancyTable`.
- `BACKLOG.md` — remove resolved Minors; reviewers append new ones under `## Step 2 (triage UI)`.

Each new source file gets a co-located `*.test.ts`/`*.test.tsx`, matching this repo's existing convention.

---

### Task 1: Hardening the write/read path (reviewer)

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `vitest.config.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/vacancyActions/writeVacancyAction.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.ts`
- Modify: `src/lib/vacancyActions/deriveVacancyStatus.ts`
- Modify: `src/lib/vacancyActions/validation.ts`
- Modify: `src/lib/vacancyActions/writeVacancyAction.test.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.test.ts`
- Modify: `src/lib/vacancyActions/deriveVacancyStatus.test.ts`
- Modify: `src/app/actions.test.ts`
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: nothing new from later tasks.
- Produces: `IGNORE_REASONS: readonly IgnoreReason[]` now **exported** from `@/lib/vacancyActions/validation` — Task 3 and Task 4 import it directly for the reason-filter links and the "ignore with reason" `<select>` options. No other public signature changes (`writeVacancyAction`, `getVacancyStatuses`, `deriveVacancyStatus` keep their existing exported types; Task 2 refactors `getVacancyStatuses`'s internals but not its signature).

#### Step 1: Install `server-only` and teach Vitest about it

Run:
```bash
npm install server-only
```

The installed package's `package.json` resolves `"default"` (what Node/Vitest use) to `index.js`, which unconditionally throws — it only resolves to the no-op `empty.js` under the `"react-server"` condition that Next's bundler sets for server components. Vitest doesn't set that condition, so importing `"server-only"` directly in a test run throws. Alias it to the no-op file in `vitest.config.ts`:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {},
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
```

This only affects module resolution inside Vitest; `next build` is untouched, so a real accidental client-side import of one of these modules still fails the production build exactly as `server-only` intends.

- [ ] **Step 1a: Run the full suite to confirm it still passes untouched**

Run: `npx vitest run`
Expected: all pre-existing tests still PASS (no test yet imports `server-only`).

#### Step 2: Add the `server-only` guard to the three modules

```ts
// src/lib/supabase/server.ts — add as the very first line
import "server-only";

import { createClient } from "@supabase/supabase-js";
// ...rest unchanged
```

```ts
// src/lib/vacancyActions/writeVacancyAction.ts — add as the very first line
import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
// ...rest unchanged for now (next step changes the client-fetch line)
```

```ts
// src/lib/vacancyActions/getVacancyStatuses.ts — add as the very first line
import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
// ...rest unchanged
```

- [ ] **Step 2a: Run the full suite**

Run: `npx vitest run`
Expected: PASS. (`src/lib/vacancies/getVacancies.ts`, `src/lib/sync/getLatestSyncRun.ts`, etc. import `@/lib/supabase/server`, which is mocked in their tests via `vi.mock("@/lib/supabase/server", ...)`, so the real `server-only` import inside the *mocked* module is never actually reached in those tests. `writeVacancyAction.test.ts` and `getVacancyStatuses.test.ts` mock the same module, so they're unaffected too.)

#### Step 3: `writeVacancyAction` — safe failure when `getSupabaseServerClient()` throws

Write the failing test first. Restructure the test file's Supabase mock so `getSupabaseServerClient` itself is a controllable `vi.fn()` (today it's a fixed arrow function), then add the new test:

```ts
// src/lib/vacancyActions/writeVacancyAction.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;
let insertMock: any;
let getSupabaseServerClientMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: (...args: any[]) => getSupabaseServerClientMock(...args),
}));

import { writeVacancyAction } from "./writeVacancyAction";

function vacanciesTable(result: { data: unknown; error: unknown }) {
  const maybeSingleMock = vi.fn(() => Promise.resolve(result));
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  return { table: { select: () => ({ eq: eqMock }) }, eqMock, maybeSingleMock };
}

function vacancyActionsTable(fetchResult: { data: unknown; error: unknown }) {
  const orderMock = vi.fn(() => Promise.resolve(fetchResult));
  const eqMock = vi.fn(() => ({ order: orderMock }));
  return {
    table: { select: () => ({ eq: eqMock }), insert: (row: unknown) => insertMock(row) },
    eqMock,
    orderMock,
  };
}

function mockTables({
  vacancy = { data: { id: 1 }, error: null },
  actionRows = { data: [], error: null },
  insertResult = { error: null },
}: {
  vacancy?: { data: unknown; error: unknown };
  actionRows?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
} = {}) {
  insertMock.mockResolvedValue(insertResult);
  const vacancies = vacanciesTable(vacancy);
  const actions = vacancyActionsTable(actionRows);
  fromMock.mockImplementation((table: string) => (table === "vacancies" ? vacancies.table : actions.table));
  getSupabaseServerClientMock.mockImplementation(() => ({ from: fromMock }));
  return { vacancies, actions };
}

beforeEach(() => {
  fromMock = vi.fn();
  insertMock = vi.fn();
  getSupabaseServerClientMock = vi.fn(() => ({ from: fromMock }));
});
```

(The rest of the existing `describe` blocks are unchanged by this restructuring — `mockTables()` still returns the same effective mocked client — but now also returns `{ vacancies, actions }` so later steps can assert on `eqMock`/`orderMock`.)

Add the new test in a new `describe` block:

```ts
describe("writeVacancyAction client failure", () => {
  test("returns a safe message instead of rejecting when getSupabaseServerClient throws", async () => {
    getSupabaseServerClientMock.mockImplementation(() => {
      throw new Error("Missing required environment variable: SUPABASE_URL");
    });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3a: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts`
Expected: FAIL — `getSupabaseServerClient()` currently throws synchronously out of `writeVacancyAction`, which Vitest reports as the test itself throwing, not a returned `{ok:false}`.

Implement the fix:

```ts
// src/lib/vacancyActions/writeVacancyAction.ts
// ... validation checks unchanged above this point ...

  let supabase;
  try {
    supabase = getSupabaseServerClient();
  } catch {
    return { ok: false, error: SAFE_DB_ERROR };
  }

  const { data: vacancy, error: vacancyError } = await supabase
    .from("vacancies")
// ...rest unchanged
```

- [ ] **Step 3b: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts`
Expected: PASS.

#### Step 4: Assert the Supabase query arguments

Add these assertions to the existing tests (don't remove any existing assertions, just extend them to also check the mock's call arguments via the `eqMock`/`orderMock`/`maybeSingleMock` returned by `mockTables()`):

```ts
describe("writeVacancyAction vacancy existence", () => {
  test("rejects a vacancyId that doesn't exist", async () => {
    const { vacancies } = mockTables({ vacancy: { data: null, error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 999 });
    expect(result).toEqual({ ok: false, error: "Vacancy not found." });
    expect(vacancies.eqMock).toHaveBeenCalledWith("id", 999);
  });
  // ...keep the existing "returns a safe message when the existence check itself fails" test unchanged
});

describe("writeVacancyAction success paths", () => {
  test("apply from todo inserts an applied row dated today in KL", async () => {
    const { actions } = mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(actions.eqMock).toHaveBeenCalledWith("vacancy_id", 1);
    expect(actions.orderMock).toHaveBeenCalledWith("id", { ascending: true });
    expect(insertMock).toHaveBeenCalledWith({
      vacancy_id: 1,
      action: "applied",
      applied_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
  // ...other success-path tests unchanged
});
```

Do the same for `getVacancyStatuses.test.ts` (its query has no `.eq()`, only `.order()`):

```ts
// src/lib/vacancyActions/getVacancyStatuses.test.ts
function actionsTable(result: { data: unknown; error: unknown }) {
  const orderMock = vi.fn(() => Promise.resolve(result));
  return { table: { select: () => ({ order: orderMock }) }, orderMock };
}

// in the "groups rows by vacancy_id..." test, after calling getVacancyStatuses():
test("groups rows by vacancy_id and derives each vacancy's status independently", async () => {
  const { table, orderMock } = actionsTable({
    data: [
      { id: 3, vacancy_id: 10, action: "reset", ignore_reason: null, applied_on: null, created_at: "2026-10-03T00:00:00.000Z" },
      { id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-02T00:00:00.000Z" },
      { id: 1, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" },
    ],
    error: null,
  });
  fromMock.mockReturnValue(table);

  const statuses = await getVacancyStatuses();

  expect(statuses.get(10)).toEqual({ status: "todo" });
  expect(statuses.get(20)).toEqual({ status: "ignored", reason: "language", date: "2026-10-02" });
  expect(statuses.size).toBe(2);
  expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
});
```

(Apply the same `fromMock.mockReturnValue(table)` + destructure pattern to the other three existing tests in that file, keeping their assertions unchanged and adding `expect(orderMock).toHaveBeenCalledWith("id", { ascending: false })` to at least one more of them. **Note for Task 2:** this file's mock shape changes again in Task 2 when `getVacancyStatuses` is refactored onto `fetchAllRows` and gains a `.range()` call — that's expected, not a regression introduced here.)

- [ ] **Step 4a: Run both files**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts src/lib/vacancyActions/getVacancyStatuses.test.ts`
Expected: PASS, no implementation changes needed (the real query calls already match — this step only strengthens what the tests check).

#### Step 5: The four guard-rejection tests must assert no insert happened

Add `expect(insertMock).not.toHaveBeenCalled();` to each of the four tests in the `"writeVacancyAction guards"` describe block:

```ts
describe("writeVacancyAction guards", () => {
  test("apply is rejected when already applied", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Already marked as applied." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("ignore is rejected when already ignored", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "language" });
    expect(result).toEqual({ ok: false, error: "Already marked as ignored." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("undo is rejected when already todo (no rows)", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "undo", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Nothing to undo." });
    expect(insertMock).not.toHaveBeenCalled();
  });

  test("editAppliedDate is rejected unless currently applied", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const todo = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(todo).toEqual({ ok: false, error: "Can only edit the date once applied." });
    expect(insertMock).not.toHaveBeenCalled();

    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const ignored = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(ignored).toEqual({ ok: false, error: "Can only edit the date once applied." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5a: Run it**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts`
Expected: PASS (no implementation change needed — `writeVacancyAction` already returns before the insert in every guard branch; this step only makes the test catch a regression that would insert anyway).

#### Step 6: `undo` and `editAppliedDate` get the "no revalidate on failure" test

Add to `src/app/actions.test.ts`:

```ts
describe("undo", () => {
  test("calls writeVacancyAction with intent undo and revalidates on success", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await undo(3);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "undo", vacancyId: 3 });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Nothing to undo." });
    const result = await undo(3);
    expect(result).toEqual({ ok: false, error: "Nothing to undo." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("editAppliedDate", () => {
  test("calls writeVacancyAction with intent editAppliedDate and the given date", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await editAppliedDate(4, "2026-10-01");
    expect(writeVacancyActionMock).toHaveBeenCalledWith({
      intent: "editAppliedDate",
      vacancyId: 4,
      appliedOn: "2026-10-01",
    });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Invalid date." });
    const result = await editAppliedDate(4, "not-a-date");
    expect(result).toEqual({ ok: false, error: "Invalid date." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
```

(Replace the existing `undo` and `editAppliedDate` `describe` blocks with these expanded versions — same first test, plus the new second test in each.)

- [ ] **Step 6a: Run it to verify it fails, then passes**

Run: `npx vitest run src/app/actions.test.ts`
Expected: the two new tests FAIL only if `apply`/`undo`/`editAppliedDate` called `revalidatePath` unconditionally — they don't (each already checks `result.ok` first), so this should PASS immediately with no implementation change. Confirm by running.

#### Step 7: Type `IGNORE_REASONS` from the `IgnoreReason` union and export it

```ts
// src/lib/vacancyActions/validation.ts
import { isDateNotInFutureKl, isValidDateString } from "@/lib/format/kualaLumpurDate";
import type { IgnoreReason } from "./types";

export const IGNORE_REASONS: readonly IgnoreReason[] = ["language", "location", "seniority", "other"];

export function isValidVacancyId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isValidIgnoreReason(value: unknown): value is IgnoreReason {
  return typeof value === "string" && (IGNORE_REASONS as readonly string[]).includes(value);
}

export function isValidAppliedOnDate(value: unknown, now: Date = new Date()): value is string {
  return typeof value === "string" && isValidDateString(value) && isDateNotInFutureKl(value, now);
}
```

No test file changes needed here — `validation.test.ts`'s existing tests exercise `isValidIgnoreReason` through its behavior, which is unchanged; the type change is caught at compile time (`npx tsc --noEmit`), not by a new runtime test. Add one assertion to confirm the exported list has the right shape:

```ts
// src/lib/vacancyActions/validation.test.ts — add to the existing file
import { IGNORE_REASONS, isValidAppliedOnDate, isValidIgnoreReason, isValidVacancyId } from "./validation";

describe("IGNORE_REASONS", () => {
  test("exports exactly the four allowed reasons", () => {
    expect(IGNORE_REASONS).toEqual(["language", "location", "seniority", "other"]);
  });
});
```

- [ ] **Step 7a: Run the type checker and the test**

Run: `npx tsc --noEmit && npx vitest run src/lib/vacancyActions/validation.test.ts`
Expected: both PASS.

#### Step 8: Runtime-safe narrowing in `deriveVacancyStatus`

Write the failing test first:

```ts
// src/lib/vacancyActions/deriveVacancyStatus.test.ts — add to the existing file
test("throws if the latest applied row has no appliedOn (a corrupt/impossible row)", () => {
  const rows = [row({ id: 1, action: "applied", appliedOn: null })];
  expect(() => deriveVacancyStatus(rows)).toThrow(/appliedOn/i);
});
```

- [ ] **Step 8a: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/deriveVacancyStatus.test.ts`
Expected: FAIL — today this silently returns `{ status: "applied", appliedOn: null as any }` instead of throwing.

Implement:

```ts
// src/lib/vacancyActions/deriveVacancyStatus.ts
import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import type { VacancyActionRow, VacancyStatus } from "./types";

export function deriveVacancyStatus(rows: VacancyActionRow[]): VacancyStatus {
  if (rows.length === 0) {
    return { status: "todo" };
  }

  const latest = rows.reduce((highest, row) => (row.id > highest.id ? row : highest));

  if (latest.action === "reset") {
    return { status: "todo" };
  }

  if (latest.action === "applied") {
    if (typeof latest.appliedOn !== "string") {
      throw new Error(`Applied action row ${latest.id} is missing appliedOn`);
    }
    return { status: "applied", appliedOn: latest.appliedOn };
  }

  return {
    status: "ignored",
    reason: latest.ignoreReason,
    date: getKlDateString(new Date(latest.createdAt)),
  };
}
```

- [ ] **Step 8b: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/deriveVacancyStatus.test.ts`
Expected: PASS (8 tests).

#### Step 9: Full suite, BACKLOG cleanup, commit

- [ ] **Step 9a: Run the entire suite**

Run: `npx vitest run`
Expected: all tests PASS, zero failures.

- [ ] **Step 9b: Remove the resolved BACKLOG.md Minors**

Delete these seven lines from the `## Epic 4 (vacancy actions) deferred Minor findings — 6 Oct` section:

```
- Task 2 (status derivation): `deriveVacancyStatus` uses `latest.appliedOn as string` instead of runtime-safe narrowing — latent risk if an "applied" row ever has a null `appliedOn` — `src/lib/vacancyActions/deriveVacancyStatus.ts`.
- Task 4 (validators): `IGNORE_REASONS` is typed `readonly string[]` instead of being tied to the `IgnoreReason` union, so a typo'd literal wouldn't be caught at compile time — `src/lib/vacancyActions/validation.ts`.
- Task 5 (write function): no `import "server-only"` guard on the two modules that reach the service-role Supabase client — `src/lib/vacancyActions/writeVacancyAction.ts` / `src/lib/vacancyActions/getVacancyStatuses.ts`.
- Task 5 (write function): `getSupabaseServerClient()` inside `writeVacancyAction` is uncaught — a missing env var rejects the promise instead of returning `{ok:false, error}`; the future UI task must handle a rejected Server Action, not just a `{ok:false}` result — `src/lib/vacancyActions/writeVacancyAction.ts`.
- Task 5 (write function tests): Supabase mocks ignore query arguments (`.eq()`/`.order()` accept anything and return a fixed result), so a wrong `vacancy_id` filter wouldn't be caught by the suite — `src/lib/vacancyActions/writeVacancyAction.test.ts`.
- Task 5 (write function tests): the four guard-rejection tests don't assert the insert was skipped — an implementation that returned the right error but still inserted would pass — `src/lib/vacancyActions/writeVacancyAction.test.ts`.
- Task 6 (Server Actions tests): only `apply` has a test asserting `revalidatePath` is NOT called on failure; `undo` and `editAppliedDate` don't have the equivalent test — `src/app/actions.test.ts`.
```

- [ ] **Step 9c: Commit**

```bash
git add package.json package-lock.json vitest.config.ts \
  src/lib/supabase/server.ts \
  src/lib/vacancyActions/writeVacancyAction.ts src/lib/vacancyActions/writeVacancyAction.test.ts \
  src/lib/vacancyActions/getVacancyStatuses.ts src/lib/vacancyActions/getVacancyStatuses.test.ts \
  src/lib/vacancyActions/deriveVacancyStatus.ts src/lib/vacancyActions/deriveVacancyStatus.test.ts \
  src/lib/vacancyActions/validation.ts src/lib/vacancyActions/validation.test.ts \
  src/app/actions.test.ts BACKLOG.md
git commit -m "Harden vacancy action write/read path: server-only guards, safe client failure, stricter tests"
```

---

### Task 2: Tab data, with a pagination-cap fix (reviewer)

**Investigation finding (read this before writing any code):** Neither `getVacancies()` nor `getVacancyStatuses()` sets `.limit()`/`.range()`. There's no cap in this codebase's code — but Supabase/PostgREST enforces its own default max-rows cap (1000 per request) at the project-config level, invisible from this repo. A live read-only check found `vacancies` at 51 rows and `vacancy_actions` at 0 — nowhere near the cap today, so there's no active bug, but nothing stops a silent undercount once either table grows past 1000 rows (a vacancy whose action rows fall outside a truncated page would misreport as "todo"; the "all" count would stop growing past 1000). Fix: a shared pagination helper that both functions use so they always read the complete table.

**Files:**
- Create: `src/lib/supabase/fetchAllRows.ts`
- Create: `src/lib/supabase/fetchAllRows.test.ts`
- Create: `src/lib/vacancies/getVacancies.test.ts`
- Modify: `src/lib/vacancies/getVacancies.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.ts`
- Modify: `src/lib/vacancyActions/getVacancyStatuses.test.ts`
- Create: `src/lib/vacancyActions/vacancyTabs.ts`
- Create: `src/lib/vacancyActions/vacancyTabs.test.ts`
- Create: `src/lib/vacancyActions/getVacancyTabData.ts`
- Create: `src/lib/vacancyActions/getVacancyTabData.test.ts`
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: `getVacancies`/`Vacancy` from `@/lib/vacancies/getVacancies`; `getVacancyStatuses`/`VacancyStatus` from `@/lib/vacancyActions/getVacancyStatuses` (now paginated, same external signature); `IgnoreReason` from `@/lib/vacancyActions/types`; `IGNORE_REASONS` from `@/lib/vacancyActions/validation` (Task 1).
- Produces:
  - From `@/lib/supabase/fetchAllRows`: `SUPABASE_MAX_ROWS = 1000`, `fetchAllRows<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]>`.
  - From `@/lib/vacancyActions/vacancyTabs`: `VacancyTabView = "todo" | "applied" | "ignored" | "all"`; `VacancyTabRow = { id: number; title: string; company: string; location: string | null; url: string; firstSeenAt: string; status: "todo" | "applied" | "ignored"; appliedOn: string | null; ignoredOn: string | null; ignoreReason: IgnoreReason | null }`; `VacancyTabCounts = { todo: number; applied: number; ignored: number; all: number }`; `resolveView(value: string | string[] | undefined): VacancyTabView`; `resolveReasonFilter(view: VacancyTabView, value: string | string[] | undefined): IgnoreReason | "none" | null`; `buildVacancyTabRow(vacancy: Vacancy, status: VacancyStatus): VacancyTabRow`; `selectRowsForView(rows: VacancyTabRow[], view: VacancyTabView, reasonFilter: IgnoreReason | "none" | null): VacancyTabRow[]`; `countByView(rows: VacancyTabRow[]): VacancyTabCounts`.
  - From `@/lib/vacancyActions/getVacancyTabData`: `VacancyTabSearchParams = { view?: string | string[]; reason?: string | string[] }`; `VacancyTabData = { view: VacancyTabView; reasonFilter: IgnoreReason | "none" | null; counts: VacancyTabCounts; rows: VacancyTabRow[] }`; `getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData>`.

  Task 3 imports `getVacancyTabData`, `VacancyTabView`, `VacancyTabRow`, `VacancyTabCounts` directly; it also imports `IgnoreReason`/`IGNORE_REASONS` for display labels and the reason-filter UI. Task 4 imports `IGNORE_REASONS` and the row `status` field's literal type.

#### Step 1: Write the failing tests for `fetchAllRows`

```ts
// src/lib/supabase/fetchAllRows.test.ts
import { describe, expect, test, vi } from "vitest";
import { fetchAllRows, SUPABASE_MAX_ROWS } from "./fetchAllRows";

function page(n: number, startId: number) {
  return Array.from({ length: n }, (_, i) => ({ id: startId + i }));
}

describe("fetchAllRows", () => {
  test("returns everything from a single page under the cap, in one request", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: page(3, 1), error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, SUPABASE_MAX_ROWS - 1);
  });

  test("keeps paging past a full (capped) page until a short page ends it — fails without pagination", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page(SUPABASE_MAX_ROWS, 1), error: null })
      .mockResolvedValueOnce({ data: page(2, SUPABASE_MAX_ROWS + 1), error: null });

    const rows = await fetchAllRows(fetchPage);

    expect(rows).toHaveLength(SUPABASE_MAX_ROWS + 2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1);
  });

  test("stops immediately on an empty first page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [], error: null });
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  test("throws a plain Error with the DB message when a page errors", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: null, error: { message: "connection refused" } });
    await expect(fetchAllRows(fetchPage)).rejects.toThrow("connection refused");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/supabase/fetchAllRows.test.ts`
Expected: FAIL (module not found).

#### Step 3: Implement `fetchAllRows`

```ts
// src/lib/supabase/fetchAllRows.ts
import "server-only";

export const SUPABASE_MAX_ROWS = 1000;

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + SUPABASE_MAX_ROWS - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < SUPABASE_MAX_ROWS) {
      break;
    }
    from += SUPABASE_MAX_ROWS;
  }

  return rows;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/supabase/fetchAllRows.test.ts`
Expected: PASS (4 tests).

#### Step 5: Refactor `getVacancies` onto `fetchAllRows`, with a new test file

Write the failing tests first (this is a new file — also resolves the pre-existing BACKLOG Minor about `getVacancies()` having no test):

```ts
// src/lib/vacancies/getVacancies.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancies } from "./getVacancies";
import { SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";

function vacanciesTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const rangeMock = vi.fn(() => Promise.resolve(pages[Math.min(call++, pages.length - 1)]));
  const orderMock2 = vi.fn(() => ({ range: rangeMock }));
  const orderMock1 = vi.fn(() => ({ order: orderMock2 }));
  return { table: { select: () => ({ order: orderMock1 }) }, rangeMock, orderMock1, orderMock2 };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancies", () => {
  test("maps snake_case rows to camelCase, passing a null location through as-is", async () => {
    const { table } = vacanciesTable([
      {
        data: [
          { id: 1, title: "Engineer", company: "Acme", location: null, url: "https://x/1", first_seen_at: "2026-10-01T00:00:00.000Z" },
        ],
        error: null,
      },
    ]);
    fromMock.mockReturnValue(table);

    const vacancies = await getVacancies();

    expect(vacancies).toEqual([
      { id: 1, title: "Engineer", company: "Acme", location: null, url: "https://x/1", firstSeenAt: "2026-10-01T00:00:00.000Z" },
    ]);
  });

  test("orders by first_seen_at descending, then id descending as a tiebreaker", async () => {
    const { table, orderMock1, orderMock2 } = vacanciesTable([{ data: [], error: null }]);
    fromMock.mockReturnValue(table);

    await getVacancies();

    expect(orderMock1).toHaveBeenCalledWith("first_seen_at", { ascending: false });
    expect(orderMock2).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("keeps paging past a full page so counts never silently undercount — fails without pagination", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: i + 1,
      title: `Job ${i + 1}`,
      company: "Acme",
      location: "Remote",
      url: `https://x/${i + 1}`,
      first_seen_at: "2026-10-01T00:00:00.000Z",
    }));
    const secondPage = [
      { id: SUPABASE_MAX_ROWS + 1, title: "Last job", company: "Acme", location: "Remote", url: "https://x/last", first_seen_at: "2026-09-30T00:00:00.000Z" },
    ];
    const { table, rangeMock } = vacanciesTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
    ]);
    fromMock.mockReturnValue(table);

    const vacancies = await getVacancies();

    expect(vacancies).toHaveLength(SUPABASE_MAX_ROWS + 1);
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, SUPABASE_MAX_ROWS - 1);
    expect(rangeMock).toHaveBeenNthCalledWith(2, SUPABASE_MAX_ROWS, SUPABASE_MAX_ROWS * 2 - 1);
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = vacanciesTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancies()).rejects.toThrow("connection refused");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancies/getVacancies.test.ts`
Expected: FAIL (current implementation has no `.range()`, so the mock chain doesn't match; also no pagination).

Implement:

```ts
// src/lib/vacancies/getVacancies.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

export interface Vacancy {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
}

type VacancyRow = {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  first_seen_at: string;
};

export async function getVacancies(): Promise<Vacancy[]> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyRow>((from, to) =>
    supabase
      .from("vacancies")
      .select("id, title, company, location, url, first_seen_at")
      .order("first_seen_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    firstSeenAt: row.first_seen_at,
  }));
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancies/getVacancies.test.ts`
Expected: PASS (4 tests).

#### Step 8: Refactor `getVacancyStatuses` onto `fetchAllRows`

Update the test file's mock shape to add the `.range()` step, and add the pagination test:

```ts
// src/lib/vacancyActions/getVacancyStatuses.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancyStatuses } from "./getVacancyStatuses";
import { SUPABASE_MAX_ROWS } from "@/lib/supabase/fetchAllRows";

function actionsTable(pages: { data: unknown; error: unknown }[]) {
  let call = 0;
  const rangeMock = vi.fn(() => Promise.resolve(pages[Math.min(call++, pages.length - 1)]));
  const orderMock = vi.fn(() => ({ range: rangeMock }));
  return { table: { select: () => ({ order: orderMock }) }, rangeMock, orderMock };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancyStatuses", () => {
  test("returns an empty map when there are no action rows", async () => {
    const { table } = actionsTable([{ data: [], error: null }]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(0);
  });

  test("groups rows by vacancy_id and derives each vacancy's status independently", async () => {
    const { table, orderMock } = actionsTable([
      {
        data: [
          { id: 3, vacancy_id: 10, action: "reset", ignore_reason: null, applied_on: null, created_at: "2026-10-03T00:00:00.000Z" },
          { id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-02T00:00:00.000Z" },
          { id: 1, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" },
        ],
        error: null,
      },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "todo" });
    expect(statuses.get(20)).toEqual({ status: "ignored", reason: "language", date: "2026-10-02" });
    expect(statuses.size).toBe(2);
    expect(orderMock).toHaveBeenCalledWith("id", { ascending: false });
  });

  test("uses only the first-seen (highest id) row per vacancy, so a truncated older row can't change the result", async () => {
    const { table } = actionsTable([
      {
        data: [
          { id: 5, vacancy_id: 10, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-05T00:00:00.000Z" },
          { id: 2, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-02", created_at: "2026-10-02T00:00:00.000Z" },
        ],
        error: null,
      },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "ignored", reason: "language", date: "2026-10-05" });
    expect(statuses.size).toBe(1);
  });

  test("keeps paging past a full page so no vacancy's status goes missing — fails without pagination", async () => {
    const fullPage = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => ({
      id: SUPABASE_MAX_ROWS - i,
      vacancy_id: SUPABASE_MAX_ROWS - i,
      action: "applied",
      ignore_reason: null,
      applied_on: "2026-10-01",
      created_at: "2026-10-01T00:00:00.000Z",
    }));
    const secondPage = [
      {
        id: 1,
        vacancy_id: 999,
        action: "ignored",
        ignore_reason: "other",
        applied_on: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const { table, rangeMock } = actionsTable([
      { data: fullPage, error: null },
      { data: secondPage, error: null },
    ]);
    fromMock.mockReturnValue(table);

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(SUPABASE_MAX_ROWS + 1);
    expect(statuses.get(999)).toEqual({ status: "ignored", reason: "other", date: "2026-09-01" });
    expect(rangeMock).toHaveBeenCalledTimes(2);
  });

  test("throws a plain Error with the DB message when a page fails", async () => {
    const { table } = actionsTable([{ data: null, error: { message: "connection refused" } }]);
    fromMock.mockReturnValue(table);

    await expect(getVacancyStatuses()).rejects.toThrow("connection refused");
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/getVacancyStatuses.test.ts`
Expected: FAIL (mock now expects a `.range()` call the current implementation never makes; the new pagination test fails outright).

Implement:

```ts
// src/lib/vacancyActions/getVacancyStatuses.ts
import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { VacancyActionRow, VacancyStatus } from "./types";

type VacancyActionDbRow = {
  id: number;
  vacancy_id: number;
  action: "applied" | "ignored" | "reset";
  ignore_reason: VacancyActionRow["ignoreReason"];
  applied_on: string | null;
  created_at: string;
};

export async function getVacancyStatuses(): Promise<Map<number, VacancyStatus>> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyActionDbRow>((from, to) =>
    supabase
      .from("vacancy_actions")
      .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
      .order("id", { ascending: false })
      .range(from, to)
  );

  const latestRowByVacancyId = new Map<number, VacancyActionRow>();
  for (const row of rows) {
    const mapped: VacancyActionRow = {
      id: row.id,
      vacancyId: row.vacancy_id,
      action: row.action,
      ignoreReason: row.ignore_reason,
      appliedOn: row.applied_on,
      createdAt: row.created_at,
    };
    // Rows arrive highest id first, so the first row seen for a vacancy is its latest.
    if (!latestRowByVacancyId.has(mapped.vacancyId)) {
      latestRowByVacancyId.set(mapped.vacancyId, mapped);
    }
  }

  const statuses = new Map<number, VacancyStatus>();
  for (const [vacancyId, latestRow] of latestRowByVacancyId) {
    statuses.set(vacancyId, deriveVacancyStatus([latestRow]));
  }
  return statuses;
}
```

- [ ] **Step 10: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/getVacancyStatuses.test.ts`
Expected: PASS (5 tests).

#### Step 11: Write the failing tests for the pure tab helpers

```ts
// src/lib/vacancyActions/vacancyTabs.test.ts
import { describe, expect, test } from "vitest";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveView,
  selectRowsForView,
  type VacancyTabRow,
} from "./vacancyTabs";
import type { Vacancy } from "@/lib/vacancies/getVacancies";
import type { VacancyStatus } from "./types";

function vacancy(overrides: Partial<Vacancy> = {}): Vacancy {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function tabRow(overrides: Partial<VacancyTabRow> = {}): VacancyTabRow {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    status: "todo",
    appliedOn: null,
    ignoredOn: null,
    ignoreReason: null,
    ...overrides,
  };
}

describe("resolveView", () => {
  test("defaults to todo when no param is given", () => {
    expect(resolveView(undefined)).toBe("todo");
  });

  test("accepts each known view", () => {
    expect(resolveView("todo")).toBe("todo");
    expect(resolveView("applied")).toBe("applied");
    expect(resolveView("ignored")).toBe("ignored");
    expect(resolveView("all")).toBe("all");
  });

  test("falls back to todo for an unknown value", () => {
    expect(resolveView("bogus")).toBe("todo");
  });

  test("takes the first element when given an array (and falls back if that's unknown)", () => {
    expect(resolveView(["applied", "all"])).toBe("applied");
    expect(resolveView(["bogus"])).toBe("todo");
  });
});

describe("resolveReasonFilter", () => {
  test("is always null outside the ignored tab, even with a valid-looking reason", () => {
    expect(resolveReasonFilter("todo", "language")).toBeNull();
    expect(resolveReasonFilter("applied", "none")).toBeNull();
    expect(resolveReasonFilter("all", "other")).toBeNull();
  });

  test("accepts each known reason and 'none' on the ignored tab", () => {
    expect(resolveReasonFilter("ignored", "language")).toBe("language");
    expect(resolveReasonFilter("ignored", "location")).toBe("location");
    expect(resolveReasonFilter("ignored", "seniority")).toBe("seniority");
    expect(resolveReasonFilter("ignored", "other")).toBe("other");
    expect(resolveReasonFilter("ignored", "none")).toBe("none");
  });

  test("is null when absent or unknown on the ignored tab (meaning: all reasons)", () => {
    expect(resolveReasonFilter("ignored", undefined)).toBeNull();
    expect(resolveReasonFilter("ignored", "bogus")).toBeNull();
  });
});

describe("buildVacancyTabRow", () => {
  test("todo status carries no date/reason", () => {
    const status: VacancyStatus = { status: "todo" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(tabRow({ status: "todo" }));
  });

  test("applied status carries appliedOn, no ignoredOn/reason", () => {
    const status: VacancyStatus = { status: "applied", appliedOn: "2026-10-02" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(
      tabRow({ status: "applied", appliedOn: "2026-10-02" })
    );
  });

  test("ignored status carries ignoredOn and reason (possibly null)", () => {
    const status: VacancyStatus = { status: "ignored", reason: "location", date: "2026-10-03" };
    expect(buildVacancyTabRow(vacancy(), status)).toEqual(
      tabRow({ status: "ignored", ignoredOn: "2026-10-03", ignoreReason: "location" })
    );
  });
});

describe("selectRowsForView", () => {
  const rows = [
    tabRow({ id: 1, status: "todo" }),
    tabRow({ id: 2, status: "applied", appliedOn: "2026-10-01" }),
    tabRow({ id: 3, status: "ignored", ignoreReason: "language", ignoredOn: "2026-10-01" }),
    tabRow({ id: 4, status: "ignored", ignoreReason: null, ignoredOn: "2026-10-02" }),
  ];

  test("all returns every row, preserving order", () => {
    expect(selectRowsForView(rows, "all", null).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  test("todo/applied/ignored each return only their own status", () => {
    expect(selectRowsForView(rows, "todo", null).map((r) => r.id)).toEqual([1]);
    expect(selectRowsForView(rows, "applied", null).map((r) => r.id)).toEqual([2]);
    expect(selectRowsForView(rows, "ignored", null).map((r) => r.id)).toEqual([3, 4]);
  });

  test("a reason filter on the ignored tab narrows further", () => {
    expect(selectRowsForView(rows, "ignored", "language").map((r) => r.id)).toEqual([3]);
  });

  test("'none' means ignored with a null reason", () => {
    expect(selectRowsForView(rows, "ignored", "none").map((r) => r.id)).toEqual([4]);
  });

  test("a reason filter is ignored on every other tab", () => {
    expect(selectRowsForView(rows, "todo", "language").map((r) => r.id)).toEqual([1]);
  });
});

describe("countByView", () => {
  test("counts each status plus the total, unaffected by any filter", () => {
    const rows = [
      tabRow({ id: 1, status: "todo" }),
      tabRow({ id: 2, status: "todo" }),
      tabRow({ id: 3, status: "applied" }),
      tabRow({ id: 4, status: "ignored" }),
    ];
    expect(countByView(rows)).toEqual({ todo: 2, applied: 1, ignored: 1, all: 4 });
  });

  test("all-zero counts for an empty vacancy list", () => {
    expect(countByView([])).toEqual({ todo: 0, applied: 0, ignored: 0, all: 0 });
  });
});
```

- [ ] **Step 12: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/vacancyTabs.test.ts`
Expected: FAIL (module not found).

#### Step 13: Implement the pure helpers

```ts
// src/lib/vacancyActions/vacancyTabs.ts
import { IGNORE_REASONS } from "./validation";
import type { Vacancy } from "@/lib/vacancies/getVacancies";
import type { IgnoreReason, VacancyStatus } from "./types";

export type VacancyTabView = "todo" | "applied" | "ignored" | "all";

export type VacancyTabRow = {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
  status: "todo" | "applied" | "ignored";
  appliedOn: string | null;
  ignoredOn: string | null;
  ignoreReason: IgnoreReason | null;
};

export type VacancyTabCounts = {
  todo: number;
  applied: number;
  ignored: number;
  all: number;
};

const VIEWS: readonly VacancyTabView[] = ["todo", "applied", "ignored", "all"];
const REASON_FILTERS: readonly string[] = [...IGNORE_REASONS, "none"];

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveView(value: string | string[] | undefined): VacancyTabView {
  const candidate = firstOf(value);
  return (VIEWS as readonly string[]).includes(candidate ?? "") ? (candidate as VacancyTabView) : "todo";
}

export function resolveReasonFilter(
  view: VacancyTabView,
  value: string | string[] | undefined
): IgnoreReason | "none" | null {
  if (view !== "ignored") {
    return null;
  }
  const candidate = firstOf(value);
  return candidate !== undefined && REASON_FILTERS.includes(candidate)
    ? (candidate as IgnoreReason | "none")
    : null;
}

export function buildVacancyTabRow(vacancy: Vacancy, status: VacancyStatus): VacancyTabRow {
  return {
    id: vacancy.id,
    title: vacancy.title,
    company: vacancy.company,
    location: vacancy.location,
    url: vacancy.url,
    firstSeenAt: vacancy.firstSeenAt,
    status: status.status,
    appliedOn: status.status === "applied" ? status.appliedOn : null,
    ignoredOn: status.status === "ignored" ? status.date : null,
    ignoreReason: status.status === "ignored" ? status.reason : null,
  };
}

export function selectRowsForView(
  rows: VacancyTabRow[],
  view: VacancyTabView,
  reasonFilter: IgnoreReason | "none" | null
): VacancyTabRow[] {
  const byView = view === "all" ? rows : rows.filter((row) => row.status === view);
  if (view !== "ignored" || reasonFilter === null) {
    return byView;
  }
  return reasonFilter === "none"
    ? byView.filter((row) => row.ignoreReason === null)
    : byView.filter((row) => row.ignoreReason === reasonFilter);
}

export function countByView(rows: VacancyTabRow[]): VacancyTabCounts {
  return {
    todo: rows.filter((row) => row.status === "todo").length,
    applied: rows.filter((row) => row.status === "applied").length,
    ignored: rows.filter((row) => row.status === "ignored").length,
    all: rows.length,
  };
}
```

- [ ] **Step 14: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/vacancyTabs.test.ts`
Expected: PASS (18 tests).

#### Step 15: Write the failing test for the server-only composition

```ts
// src/lib/vacancyActions/getVacancyTabData.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let getVacanciesMock: any;
let getVacancyStatusesMock: any;

vi.mock("@/lib/vacancies/getVacancies", () => ({
  getVacancies: (...args: any[]) => getVacanciesMock(...args),
}));
vi.mock("./getVacancyStatuses", () => ({
  getVacancyStatuses: (...args: any[]) => getVacancyStatusesMock(...args),
}));

import { getVacancyTabData } from "./getVacancyTabData";

beforeEach(() => {
  getVacanciesMock = vi.fn();
  getVacancyStatusesMock = vi.fn();
});

const VACANCIES = [
  { id: 1, title: "A", company: "Co A", location: "KL", url: "https://x/1", firstSeenAt: "2026-10-03T00:00:00.000Z" },
  { id: 2, title: "B", company: "Co B", location: null, url: "https://x/2", firstSeenAt: "2026-10-02T00:00:00.000Z" },
  { id: 3, title: "C", company: "Co C", location: "Penang", url: "https://x/3", firstSeenAt: "2026-10-01T00:00:00.000Z" },
];

describe("getVacancyTabData", () => {
  test("combines vacancies with statuses, defaults to the todo tab, keeps newest-first order", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(
      new Map([
        [2, { status: "applied", appliedOn: "2026-10-02" }],
        [3, { status: "ignored", reason: "other", date: "2026-10-01" }],
      ])
    );

    const result = await getVacancyTabData({});

    expect(result.view).toBe("todo");
    expect(result.reasonFilter).toBeNull();
    expect(result.counts).toEqual({ todo: 1, applied: 1, ignored: 1, all: 3 });
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });

  test("a vacancy with no status row at all is todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "all" });

    expect(result.rows.map((r) => r.status)).toEqual(["todo", "todo", "todo"]);
  });

  test("the reason filter only narrows the ignored tab's rows, never its counts", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(
      new Map([
        [2, { status: "ignored", reason: "language", date: "2026-10-02" }],
        [3, { status: "ignored", reason: "other", date: "2026-10-01" }],
      ])
    );

    const result = await getVacancyTabData({ view: "ignored", reason: "language" });

    expect(result.reasonFilter).toBe("language");
    expect(result.rows.map((r) => r.id)).toEqual([2]);
    expect(result.counts).toEqual({ todo: 1, applied: 0, ignored: 2, all: 3 });
  });

  test("an unknown view param falls back to todo", async () => {
    getVacanciesMock.mockResolvedValue(VACANCIES);
    getVacancyStatusesMock.mockResolvedValue(new Map());

    const result = await getVacancyTabData({ view: "bogus" });

    expect(result.view).toBe("todo");
  });
});
```

- [ ] **Step 16: Run it to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/getVacancyTabData.test.ts`
Expected: FAIL (module not found).

#### Step 17: Implement the composition

```ts
// src/lib/vacancyActions/getVacancyTabData.ts
import "server-only";

import { getVacancies } from "@/lib/vacancies/getVacancies";
import { getVacancyStatuses } from "./getVacancyStatuses";
import {
  buildVacancyTabRow,
  countByView,
  resolveReasonFilter,
  resolveView,
  selectRowsForView,
  type VacancyTabCounts,
  type VacancyTabRow,
  type VacancyTabView,
} from "./vacancyTabs";
import type { IgnoreReason } from "./types";

export type VacancyTabSearchParams = {
  view?: string | string[];
  reason?: string | string[];
};

export type VacancyTabData = {
  view: VacancyTabView;
  reasonFilter: IgnoreReason | "none" | null;
  counts: VacancyTabCounts;
  rows: VacancyTabRow[];
};

export async function getVacancyTabData(params: VacancyTabSearchParams): Promise<VacancyTabData> {
  const [vacancies, statuses] = await Promise.all([getVacancies(), getVacancyStatuses()]);

  const allRows = vacancies.map((vacancy) =>
    buildVacancyTabRow(vacancy, statuses.get(vacancy.id) ?? { status: "todo" })
  );

  const view = resolveView(params.view);
  const reasonFilter = resolveReasonFilter(view, params.reason);

  return {
    view,
    reasonFilter,
    counts: countByView(allRows),
    rows: selectRowsForView(allRows, view, reasonFilter),
  };
}
```

- [ ] **Step 18: Run it to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/getVacancyTabData.test.ts`
Expected: PASS (4 tests).

#### Step 19: Full suite, BACKLOG cleanup, commit

- [ ] **Step 19a:** Run `npx vitest run` — expect all tests PASS.
- [ ] **Step 19b:** Run `npx tsc --noEmit` — expect no errors.
- [ ] **Step 19c:** Remove this resolved line from the `## Epic 3 (dashboard) deferred Minor findings — 6 Oct` section of `BACKLOG.md` (now resolved by Step 5's new `getVacancies.test.ts`):

```
- Task 3 (vacancy list): no automated test for `getVacancies()` (ordering, null-location passthrough, snake_case→camelCase mapping) — `src/lib/vacancies/getVacancies.ts`.
```

- [ ] **Step 19d:** Commit:

```bash
git add src/lib/supabase/fetchAllRows.ts src/lib/supabase/fetchAllRows.test.ts \
  src/lib/vacancies/getVacancies.ts src/lib/vacancies/getVacancies.test.ts \
  src/lib/vacancyActions/getVacancyStatuses.ts src/lib/vacancyActions/getVacancyStatuses.test.ts \
  src/lib/vacancyActions/vacancyTabs.ts src/lib/vacancyActions/vacancyTabs.test.ts \
  src/lib/vacancyActions/getVacancyTabData.ts src/lib/vacancyActions/getVacancyTabData.test.ts \
  BACKLOG.md
git commit -m "Paginate vacancy/action reads past Supabase's row cap; add per-tab vacancy rows and counts"
```

---

### Task 3: Tabs and table on the dashboard page (no reviewer — visual check by the user)

**Files:**
- Modify: `package.json`, `package-lock.json` (add `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` as devDependencies)
- Create: `src/app/VacancyTabs.tsx`
- Create: `src/app/VacancyTabs.test.tsx`
- Create: `src/app/VacancyTable.tsx`
- Create: `src/app/VacancyTable.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: `getVacancyTabData`, `VacancyTabSearchParams` (Task 2); `VacancyTabView`, `VacancyTabRow`, `VacancyTabCounts` (Task 2); `IgnoreReason` (Task 1's module); `getLatestSyncRun`, `getSyncAlert`, `formatKlDate`, `formatKlDateTime`, `SyncButton` (all pre-existing, unchanged).
- Produces: `VacancyTabs({ view, counts, reasonFilter }): JSX.Element` and `VacancyTable({ view, rows }): JSX.Element` — both plain, synchronous, side-effect-free components taking only props. `page.tsx`'s `Home` keeps the same `searchParams` prop shape as before but is now a thin loader with no table/tab markup of its own; **it is never rendered in a test**. The Actions column in `VacancyTable` renders an empty `<td>` for now — Task 4 replaces it with `<VacancyActions />`, which is the only part of `VacancyTable.tsx` Task 4 touches again.

#### Step 1: Install the rendering-test tooling

```bash
npm install --save-dev jsdom @testing-library/react @testing-library/jest-dom
```

These stay devDependencies only. No global `vitest.config.ts` change — both new test files in this plan opt into `jsdom` per-file via a docblock pragma, so every other test file keeps running under Vitest's default `node` environment untouched.

#### Step 2: Write the failing tests for `VacancyTabs`

```tsx
// src/app/VacancyTabs.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { VacancyTabs } from "./VacancyTabs";

describe("VacancyTabs", () => {
  test("marks the active tab with aria-current and shows each tab's count", () => {
    render(
      <VacancyTabs view="applied" counts={{ todo: 2, applied: 1, ignored: 3, all: 6 }} reasonFilter={null} />
    );
    const activeTab = screen.getByRole("link", { name: /applied \(1\)/i });
    expect(activeTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /to do \(2\)/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /all \(6\)/i })).toBeInTheDocument();
  });

  test("shows the reason filter links only on the ignored tab", () => {
    render(<VacancyTabs view="todo" counts={{ todo: 0, applied: 0, ignored: 0, all: 0 }} reasonFilter={null} />);
    expect(screen.queryByRole("link", { name: "No reason" })).not.toBeInTheDocument();
  });

  test("marks the active reason filter on the ignored tab", () => {
    render(
      <VacancyTabs view="ignored" counts={{ todo: 0, applied: 0, ignored: 2, all: 2 }} reasonFilter="language" />
    );
    expect(screen.getByRole("link", { name: "Language" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All reasons" })).not.toHaveAttribute("aria-current");
  });

  test("tab links carry the right href", () => {
    render(<VacancyTabs view="todo" counts={{ todo: 0, applied: 0, ignored: 0, all: 0 }} reasonFilter={null} />);
    expect(screen.getByRole("link", { name: /applied/i })).toHaveAttribute("href", "/?view=applied");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/app/VacancyTabs.test.tsx`
Expected: FAIL (module not found).

#### Step 4: Implement `VacancyTabs`

```tsx
// src/app/VacancyTabs.tsx
import Link from "next/link";
import type { VacancyTabCounts, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

const TABS: { view: VacancyTabView; label: string }[] = [
  { view: "todo", label: "To do" },
  { view: "applied", label: "Applied" },
  { view: "ignored", label: "Ignored" },
  { view: "all", label: "All" },
];

const REASON_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All reasons" },
  { value: "language", label: "Language" },
  { value: "location", label: "Location" },
  { value: "seniority", label: "Seniority" },
  { value: "other", label: "Other" },
  { value: "none", label: "No reason" },
];

function tabHref(view: VacancyTabView): string {
  return `/?view=${view}`;
}

function reasonHref(reasonValue: string | null): string {
  return reasonValue ? `/?view=ignored&reason=${reasonValue}` : "/?view=ignored";
}

export function VacancyTabs({
  view,
  counts,
  reasonFilter,
}: {
  view: VacancyTabView;
  counts: VacancyTabCounts;
  reasonFilter: IgnoreReason | "none" | null;
}) {
  return (
    <>
      <nav aria-label="Vacancy tabs" className="mb-4 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={tabHref(tab.view)}
            aria-current={view === tab.view ? "page" : undefined}
            className={`pb-2 text-sm ${
              view === tab.view
                ? "border-b-2 border-black font-semibold text-black dark:border-white dark:text-white"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {tab.label} ({counts[tab.view]})
          </Link>
        ))}
      </nav>

      {view === "ignored" && (
        <nav aria-label="Ignore reason filter" className="mb-4 flex gap-3 text-sm">
          {REASON_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={reasonHref(filter.value)}
              aria-current={reasonFilter === filter.value ? "page" : undefined}
              className={
                reasonFilter === filter.value
                  ? "font-semibold text-black dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400"
              }
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/app/VacancyTabs.test.tsx`
Expected: PASS (4 tests).

#### Step 6: Write the failing tests for `VacancyTable`

```tsx
// src/app/VacancyTable.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { VacancyTable } from "./VacancyTable";
import type { VacancyTabRow } from "@/lib/vacancyActions/vacancyTabs";

function row(overrides: Partial<VacancyTabRow> = {}): VacancyTabRow {
  return {
    id: 1,
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job/1",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    status: "todo",
    appliedOn: null,
    ignoredOn: null,
    ignoreReason: null,
    ...overrides,
  };
}

describe("VacancyTable — empty states", () => {
  test("shows the todo empty state", () => {
    render(<VacancyTable view="todo" rows={[]} />);
    expect(screen.getByText("No vacancies to triage.")).toBeInTheDocument();
  });

  test("shows the applied empty state", () => {
    render(<VacancyTable view="applied" rows={[]} />);
    expect(screen.getByText("No applied vacancies yet.")).toBeInTheDocument();
  });

  test("shows the ignored empty state", () => {
    render(<VacancyTable view="ignored" rows={[]} />);
    expect(screen.getByText("No ignored vacancies yet.")).toBeInTheDocument();
  });

  test("shows the all empty state", () => {
    render(<VacancyTable view="all" rows={[]} />);
    expect(screen.getByText("No vacancies yet.")).toBeInTheDocument();
  });
});

describe("VacancyTable — row rendering", () => {
  test("renders a null location as an empty cell, not a crash or the word null", () => {
    render(<VacancyTable view="todo" rows={[row({ location: null })]} />);
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  test("column headers have scope=col", () => {
    render(<VacancyTable view="todo" rows={[row()]} />);
    expect(screen.getByRole("columnheader", { name: "Title" })).toHaveAttribute("scope", "col");
  });

  test("the applied tab adds an Applied on column", () => {
    render(<VacancyTable view="applied" rows={[row({ status: "applied", appliedOn: "2026-10-02" })]} />);
    expect(screen.getByRole("columnheader", { name: "Applied on" })).toBeInTheDocument();
  });

  test("the ignored tab adds Ignored on and Reason columns", () => {
    render(
      <VacancyTable
        view="ignored"
        rows={[row({ status: "ignored", ignoredOn: "2026-10-02", ignoreReason: "location" })]}
      />
    );
    expect(screen.getByRole("columnheader", { name: "Ignored on" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Reason" })).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  test("the all tab adds a Status column", () => {
    render(<VacancyTable view="all" rows={[row({ status: "ignored" })]} />);
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/app/VacancyTable.test.tsx`
Expected: FAIL (module not found).

#### Step 8: Implement `VacancyTable`

```tsx
// src/app/VacancyTable.tsx
import { formatKlDate } from "@/lib/format/kualaLumpurTime";
import type { VacancyTabRow, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

const REASON_LABELS: Record<IgnoreReason, string> = {
  language: "Language",
  location: "Location",
  seniority: "Seniority",
  other: "Other",
};

const EMPTY_STATE_TEXT: Record<VacancyTabView, string> = {
  todo: "No vacancies to triage.",
  applied: "No applied vacancies yet.",
  ignored: "No ignored vacancies yet.",
  all: "No vacancies yet.",
};

export function VacancyTable({ view, rows }: { view: VacancyTabView; rows: VacancyTabRow[] }) {
  if (rows.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">{EMPTY_STATE_TEXT[view]}</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-800">
          <th scope="col" className="py-2 pr-4">Title</th>
          <th scope="col" className="py-2 pr-4">Company</th>
          <th scope="col" className="py-2 pr-4">Location</th>
          <th scope="col" className="py-2 pr-4">First seen</th>
          <th scope="col" className="py-2 pr-4">Link</th>
          {view === "applied" && <th scope="col" className="py-2 pr-4">Applied on</th>}
          {view === "ignored" && (
            <>
              <th scope="col" className="py-2 pr-4">Ignored on</th>
              <th scope="col" className="py-2 pr-4">Reason</th>
            </>
          )}
          {view === "all" && <th scope="col" className="py-2 pr-4">Status</th>}
          <th scope="col" className="py-2 pr-4">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-900">
            <td className="py-2 pr-4">{row.title}</td>
            <td className="py-2 pr-4">{row.company}</td>
            <td className="py-2 pr-4">{row.location ?? ""}</td>
            <td className="py-2 pr-4">{formatKlDate(row.firstSeenAt)}</td>
            <td className="py-2 pr-4">
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                View
              </a>
            </td>
            {view === "applied" && (
              <td className="py-2 pr-4">{row.appliedOn ? formatKlDate(row.appliedOn) : ""}</td>
            )}
            {view === "ignored" && (
              <>
                <td className="py-2 pr-4">{row.ignoredOn ? formatKlDate(row.ignoredOn) : ""}</td>
                <td className="py-2 pr-4">
                  {row.ignoreReason ? REASON_LABELS[row.ignoreReason] : "—"}
                </td>
              </>
            )}
            {view === "all" && <td className="py-2 pr-4 capitalize">{row.status}</td>}
            <td className="py-2 pr-4" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npx vitest run src/app/VacancyTable.test.tsx`
Expected: PASS (10 tests).

#### Step 10: Rewrite `src/app/page.tsx` as a thin loader

```tsx
// src/app/page.tsx
import {
  getVacancyTabData,
  type VacancyTabSearchParams,
} from "@/lib/vacancyActions/getVacancyTabData";
import { getLatestSyncRun } from "@/lib/sync/getLatestSyncRun";
import { getSyncAlert, type AlertReason } from "@/lib/sync/getSyncAlert";
import { formatKlDateTime } from "@/lib/format/kualaLumpurTime";
import { SyncButton } from "./SyncButton";
import { VacancyTabs } from "./VacancyTabs";
import { VacancyTable } from "./VacancyTable";

export const dynamic = "force-dynamic";

function alertText(reason: AlertReason): string {
  switch (reason.type) {
    case "no-run":
      return "No sync has ever run.";
    case "stale":
      return `Last sync finished at ${formatKlDateTime(reason.finishedAt)}, more than 26 hours ago.`;
    case "error":
      return `Last sync failed: ${reason.error}`;
    case "failures":
      return `${reason.failures.length} message(s) failed: ${reason.failures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
    case "parser-failures":
      return `${reason.count} card(s) failed to parse: ${reason.parserFailures
        .map((f) => `${f.messageId} (${f.reason})`)
        .join(", ")}`;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<VacancyTabSearchParams>;
}) {
  const params = await searchParams;
  const [{ view, reasonFilter, counts, rows }, latestRun] = await Promise.all([
    getVacancyTabData(params),
    getLatestSyncRun(),
  ]);
  const alerts = getSyncAlert(latestRun, new Date());

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6 gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Vacancies</h1>

        <section>
          <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
            Sync status
          </h2>

          <div className="mb-3">
            <SyncButton />
          </div>

          {alerts.length > 0 && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              <ul className="list-disc pl-4">
                {alerts.map((reason) => (
                  <li key={reason.type}>{alertText(reason)}</li>
                ))}
              </ul>
            </div>
          )}

          {latestRun && latestRun.status === "error" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) — sync
              failed, see above.
            </p>
          )}

          {latestRun && latestRun.status === "ok" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Finished {formatKlDateTime(latestRun.finishedAt)} ({latestRun.trigger}) —{" "}
              {latestRun.messages ?? 0} messages, {latestRun.cards ?? 0} cards,{" "}
              {latestRun.inserted ?? 0} inserted, {latestRun.skipped ?? 0} skipped,{" "}
              {latestRun.warnings ?? 0} warnings.
            </p>
          )}
        </section>

        <section>
          <VacancyTabs view={view} counts={counts} reasonFilter={reasonFilter} />
          <VacancyTable view={view} rows={rows} />
        </section>
      </main>
    </div>
  );
}
```

`page.tsx` has no test file in this plan — it's an async Server Component and is intentionally never rendered directly in a test; `VacancyTabs.test.tsx` and `VacancyTable.test.tsx` already cover everything it renders.

#### Step 11: Full suite, type-check, BACKLOG cleanup, commit

- [ ] **Step 11a:** Run `npx vitest run` — expect all tests PASS.
- [ ] **Step 11b:** Run `npx tsc --noEmit` — expect no errors.
- [ ] **Step 11c:** Remove these four resolved lines from the `## Epic 3 (dashboard) deferred Minor findings — 6 Oct` section of `BACKLOG.md`:

```
- Task 3 (vacancy list): table headers have no `scope="col"` — `src/app/page.tsx`.
- Task 3 (vacancy list): no test exercises the null-location/empty-list UI rendering paths — `src/app/page.tsx`.
- Task 4 (sync status/alert): heading hierarchy has `<h2>Sync status</h2>` before `<h1>Vacancies</h1>` — `src/app/page.tsx`.
- Task 4 (sync status/alert): `alerts.map(...)` uses the array index as the React key — `src/app/page.tsx`.
```

- [ ] **Step 11d:** Commit:

```bash
git add package.json package-lock.json \
  src/app/VacancyTabs.tsx src/app/VacancyTabs.test.tsx \
  src/app/VacancyTable.tsx src/app/VacancyTable.test.tsx \
  src/app/page.tsx BACKLOG.md
git commit -m "Split the dashboard page into a thin loader plus VacancyTabs/VacancyTable components"
```

- [ ] **Step 11e:** Tell the user the dev server is ready for a visual check (`npm run dev`), since this task has no reviewer — they check it visually per the task description.

---

### Task 4: Action buttons as a client component (reviewer)

**Files:**
- Create: `src/app/VacancyActions.tsx`
- Create: `src/app/VacancyActions.test.tsx`
- Modify: `src/app/VacancyTable.tsx` (wire the component into the Actions column)

**Interfaces:**
- Consumes: `apply`, `ignore`, `undo` Server Actions from `./actions` (pre-existing, unchanged); `IgnoreReason`, `IGNORE_REASONS` from `@/lib/vacancyActions/types` / `@/lib/vacancyActions/validation` (Task 1); the row `status` field's type from `@/lib/vacancyActions/vacancyTabs` (Task 2).
- Produces: `VacancyActions({ vacancyId: number; status: "todo" | "applied" | "ignored" }): JSX.Element`, a client component with no other exports.

#### Step 1: Write the failing component tests

```tsx
// src/app/VacancyActions.test.tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let applyMock: any;
let ignoreMock: any;
let undoMock: any;

vi.mock("./actions", () => ({
  apply: (...args: any[]) => applyMock(...args),
  ignore: (...args: any[]) => ignoreMock(...args),
  undo: (...args: any[]) => undoMock(...args),
}));

import { VacancyActions } from "./VacancyActions";

beforeEach(() => {
  applyMock = vi.fn();
  ignoreMock = vi.fn();
  undoMock = vi.fn();
});

describe("VacancyActions — button sets per status", () => {
  test("todo shows Applied, Ignore, and the ignore-with-reason select", () => {
    render(<VacancyActions vacancyId={1} status="todo" />);
    expect(screen.getByRole("button", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  test("applied shows Ignore, the ignore-with-reason select, and Undo", () => {
    render(<VacancyActions vacancyId={1} status="applied" />);
    expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Applied" })).not.toBeInTheDocument();
  });

  test("ignored shows only Undo", () => {
    render(<VacancyActions vacancyId={1} status="ignored" />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ignore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("VacancyActions — clicking buttons", () => {
  test("Applied calls apply with the vacancy id", async () => {
    applyMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() => expect(applyMock).toHaveBeenCalledWith(7));
  });

  test("Ignore calls ignore with no reason", async () => {
    ignoreMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    await waitFor(() => expect(ignoreMock).toHaveBeenCalledWith(7));
  });

  test("picking a reason in the select calls ignore with that reason", async () => {
    ignoreMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="todo" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "location" } });
    await waitFor(() => expect(ignoreMock).toHaveBeenCalledWith(7, "location"));
  });

  test("Undo calls undo with the vacancy id", async () => {
    undoMock.mockResolvedValue({ ok: true });
    render(<VacancyActions vacancyId={7} status="ignored" />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoMock).toHaveBeenCalledWith(7));
  });
});

describe("VacancyActions — pending state", () => {
  test("disables this row's buttons while a click is pending, then re-enables them", async () => {
    let resolveApply!: (value: { ok: true }) => void;
    applyMock.mockReturnValue(new Promise((resolve) => (resolveApply = resolve)));
    render(<VacancyActions vacancyId={1} status="todo" />);

    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    expect(screen.getByRole("button", { name: "Applied" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeDisabled();

    resolveApply({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Applied" })).not.toBeDisabled());
  });
});

describe("VacancyActions — error paths", () => {
  test("shows the safe message from a resolved {ok:false} result", async () => {
    applyMock.mockResolvedValue({ ok: false, error: "Already marked as applied." });
    render(<VacancyActions vacancyId={1} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Already marked as applied.")
    );
  });

  test("shows a generic message when the action promise rejects, never the raw error", async () => {
    applyMock.mockRejectedValue(new Error("fetch failed: ECONNRESET"));
    render(<VacancyActions vacancyId={1} status="todo" />);
    fireEvent.click(screen.getByRole("button", { name: "Applied" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
    );
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/VacancyActions.test.tsx`
Expected: FAIL (module not found).

#### Step 3: Implement `VacancyActions`

```tsx
// src/app/VacancyActions.tsx
"use client";

import { useState } from "react";
import { apply, ignore, undo } from "./actions";
import { IGNORE_REASONS } from "@/lib/vacancyActions/validation";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const REASON_LABELS: Record<IgnoreReason, string> = {
  language: "Language",
  location: "Location",
  seniority: "Seniority",
  other: "Other",
};

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
      setError(GENERIC_ERROR);
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/VacancyActions.test.tsx`
Expected: PASS (10 tests).

#### Step 5: Wire it into `VacancyTable.tsx`

```tsx
// src/app/VacancyTable.tsx — add this import near the top
import { VacancyActions } from "./VacancyActions";
```

Replace the empty Actions cell:

```tsx
// before
<td className="py-2 pr-4" />

// after
<td className="py-2 pr-4">
  <VacancyActions vacancyId={row.id} status={row.status} />
</td>
```

Since `VacancyTable.test.tsx` doesn't mock `./actions`, this wiring will make its existing tests render the real `VacancyActions`, which calls the real (unmocked) Server Actions module on click — but none of `VacancyTable.test.tsx`'s tests click a button, so this is safe. Confirm in the next step.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all tests PASS, including `src/app/VacancyTable.test.tsx` (unaffected by this change — it never clicks a button) and the new `VacancyActions.test.tsx`.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/VacancyActions.tsx src/app/VacancyActions.test.tsx src/app/VacancyTable.tsx
git commit -m "Add Applied/Ignore/Undo action buttons to each vacancy row"
```

---

### Task 5: Final whole-branch review and push

**Files:** none (verification-only).

- [ ] **Step 1:** Run `npx vitest run` — expect all tests PASS.
- [ ] **Step 2:** Run `npx tsc --noEmit` — expect no errors.
- [ ] **Step 3:** Run `git status` — expect a clean working tree (everything already committed task-by-task).
- [ ] **Step 4:** Whole-branch review (per the user's instruction: "One final whole-branch review" — a fresh reviewer checks the full diff against `main` for correctness, the Review Focus items above, and anything a per-task review couldn't see across task boundaries). Any new Minor found goes into `BACKLOG.md` under a new heading:

```markdown
## Step 2 (triage UI)

- <finding> — `<file>`.
```

- [ ] **Step 5:** If the review added BACKLOG entries, commit that addition separately:

```bash
git add BACKLOG.md
git commit -m "Log triage UI's deferred Minor review findings in BACKLOG.md"
```

- [ ] **Step 6: Push the branch and stop**

```bash
git push -u origin feat/vacancy-triage-ui
```

Do **not** open a pull request — the user will run the Preview test and asked to push and stop.

---

## Notes for the executor

- `server-only` is a new runtime dependency (not just a dev dependency) — it's imported by code that ships in the production build, even though its only job there is to throw if a client bundle ever imports it by mistake.
- `jsdom`/`@testing-library/react`/`@testing-library/jest-dom` are dev-only and are opted into per test file via the `// @vitest-environment jsdom` pragma, so the project's default Vitest environment for every other test file is untouched.
- `page.tsx` is intentionally untested directly — it's an async Server Component with no logic of its own beyond composing `getVacancyTabData()`/`getLatestSyncRun()` and handing props to `VacancyTabs`/`VacancyTable`, both of which are fully covered.
- Task 3's Actions column is intentionally an empty `<td>` until Task 4 — this is expected, not a bug, if you're reviewing Task 3 in isolation.
- No task in this plan touches `vacancy_actions`' schema, the `writeVacancyAction` guard branches' decisions, or `deriveVacancyStatus`'s status rules for valid rows — only its failure-handling, type-safety, and (for the two read functions) pagination, per the user's explicit constraints.
