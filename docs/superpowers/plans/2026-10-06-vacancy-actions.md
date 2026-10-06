# Vacancy Action Log (Read + Write Side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for tracking vacancy actions (applied/ignored/reset) — a pure status-derivation function, a server-only read getter, and four Server Actions backed by one shared server-only write function — with no UI changes.

**Architecture:** `vacancy_actions` is an append-only log (service_role: SELECT + INSERT only, never UPDATE/DELETE). A vacancy's current status is always *derived*, never stored: take the row with the highest `id` for that vacancy; no rows, or a latest `action: 'reset'`, means `todo`. One pure function (`deriveVacancyStatus`) implements this and is reused by both the read-side getter (batches all vacancies for future dashboard use) and the write-side guard checks (so a Server Action can refuse an action that contradicts current status). Four thin Server Actions in `src/app/actions.ts` each call one shared `writeVacancyAction` function that does all validation, the guard check, and the insert, returning a uniform `{ ok: true } | { ok: false; error }` shape and never leaking raw DB errors.

**Tech Stack:** Next.js (App Router, TypeScript) Server Actions, Supabase (`@supabase/supabase-js` via `getSupabaseServerClient()`), Vitest with mocked Supabase (no live calls).

**Spec:** This plan implements the "Build iteration 1, step 1: vacancy action log" task as specified in conversation (no separate spec doc exists; the full spec is reproduced in Global Constraints and Review Focus below). Clarifying decisions made with the user before writing this plan:
- Branch `feat/vacancy-actions` is cut from `main` (not from `feat/dashboard`, which is already merged into `main` via PR #3).
- `apply(vacancyId)` takes **no** date parameter — it always inserts today's date in KL. Only `editAppliedDate` accepts a caller-supplied date.
- `ignore(vacancyId, reason?)` — `reason` is **optional**; omitting it inserts `ignore_reason: null`.
- The two BACKLOG.md Minors ("proxy matcher test", "Server Action wiring test") are resolved by **deleting** their bullet lines once tests exist, since BACKLOG.md has no done/checkbox convention today.

## Global Constraints

- Never read, print, or log values from `.env.local`; refer to env var names only (e.g. `SUPABASE_SERVICE_ROLE_KEY`) — no task in this plan needs to read `.env.local`.
- Never run schema-changing or destructive SQL. This plan requires **no schema changes** — `vacancy_actions` already exists by hand with its checks in place. If any task's code appears to need a new column or table, stop and flag it instead of writing SQL.
- `service_role` has only SELECT and INSERT on `vacancy_actions` — no task may call `.update()` or `.delete()` against it. Status changes are always a new INSERT (including `undo`, which inserts a `reset` row).
- One concern per commit; each task below is its own commit (or, where a task bundles a BACKLOG.md edit with its test, that edit is part of the same concern).
- Build/validate only against real, already-verified behavior — no guessed DB response shapes. Every Supabase mock shape in this plan mirrors the existing mocking pattern in `src/lib/sync/runSync.test.ts` (`vi.mock("@/lib/supabase/server", ...)` with a `fromMock` dispatched by table name).
- Deferred ideas go in `BACKLOG.md`, not into this task — if a task surfaces a new deferred idea while implementing, add it to BACKLOG.md rather than scope-creeping the task.
- All 42 existing tests must keep passing throughout; run the full suite (`npx vitest run`) at the end of every task, not just the new file.

## Review Focus

- **Double-click / race past the guard:** two inserts can land for the same vacancy in quick succession (e.g. two `apply` calls both pass the guard check before either insert lands). The spec says this is acceptable *as long as the derived status stays correct afterward* — covered by Task 2's "latest by id wins" tests and exercised again implicitly by Task 5's guard tests, but no task should add locking/transactions to prevent the race itself.
- **KL day-boundary date edge:** a timestamp in the late evening UTC is already the next calendar day in `Asia/Kuala_Lumpur` (UTC+8). Both "today in KL" (used by `apply`) and "not in the future in KL" (used by `editAppliedDate`) must use the KL calendar day, not the UTC one — covered in Task 1 with an explicit late-evening-UTC test case.
- **`ignore` with no reason given:** since `ignore_reason` is optional, `ignore(vacancyId)` with no second argument must still succeed and insert `ignore_reason: null`, not fail validation — covered in Task 5.
- **Non-existent `vacancyId`:** a syntactically valid positive integer that doesn't correspond to any row in `vacancies` must be rejected with a safe "not found" message, not a raw DB error and not a silent insert (there is no FK from `vacancy_actions` to enforce this at the DB layer per the given schema notes, so the application must check) — covered in Task 5.
- **Insert payload never violates the DB's own CHECK constraints:** `applied_on` must be set only on `action: 'applied'` rows and never on `'ignored'`/`'reset'` rows; `ignore_reason` must be set only on `'ignored'` rows. A bug here would be caught by the live DB check constraints in production but would surface as an opaque Postgres error — Task 5's insert-payload construction is written so each `intent` branch sets only its own fields, and Task 5's tests assert the exact payload per intent.

---

## File Structure

New files:
- `src/lib/format/kualaLumpurDate.ts` — KL calendar-date utilities (today's date, format a `Date` as a KL date string, validate a date string, check "not in the future").
- `src/lib/vacancyActions/types.ts` — shared types: `IgnoreReason`, `VacancyActionRow`, `VacancyStatus`.
- `src/lib/vacancyActions/deriveVacancyStatus.ts` — the pure status-derivation function.
- `src/lib/vacancyActions/getVacancyStatuses.ts` — server-only read getter, batches all vacancies.
- `src/lib/vacancyActions/validation.ts` — shared input validators used by the write side.
- `src/lib/vacancyActions/writeVacancyAction.ts` — the one shared server-only write function all four Server Actions call.
- `src/proxy.test.ts` — new test for the existing proxy matcher (BACKLOG Minor).

Modified files:
- `src/app/actions.ts` — add `apply`, `ignore`, `undo`, `editAppliedDate` Server Actions.
- `src/app/actions.test.ts` — **new file**, covers both the new actions' wiring and the pre-existing `runManualSync` wiring (BACKLOG Minor).
- `BACKLOG.md` — remove the two resolved Minor bullets.

Each new source file gets a co-located `*.test.ts`, matching the existing convention (no `__tests__` directory anywhere in this repo).

---

### Task 1: KL calendar-date utilities

**Files:**
- Create: `src/lib/format/kualaLumpurDate.ts`
- Test: `src/lib/format/kualaLumpurDate.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no Supabase dependency).
- Produces:
  - `getKlDateString(date?: Date): string` — returns the KL calendar date for `date` (defaults to `new Date()`) as `YYYY-MM-DD`.
  - `isValidDateString(value: string): boolean` — true iff `value` is a real calendar date in strict `YYYY-MM-DD` form (rejects `2026-02-30`, `26-10-06`, `2026-10-6`, etc).
  - `isDateNotInFutureKl(dateString: string, now?: Date): boolean` — true iff `dateString` is on or before the KL calendar date of `now` (defaults to `new Date()`).

  Later tasks (`deriveVacancyStatus`, `validation`, `writeVacancyAction`) import all three from `@/lib/format/kualaLumpurDate`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/format/kualaLumpurDate.test.ts
import { describe, expect, test } from "vitest";
import { getKlDateString, isDateNotInFutureKl, isValidDateString } from "./kualaLumpurDate";

describe("getKlDateString", () => {
  test("formats a UTC morning timestamp as the same KL calendar day", () => {
    expect(getKlDateString(new Date("2026-10-06T01:00:00.000Z"))).toBe("2026-10-06");
  });

  test("rolls over to the next KL calendar day for a late-evening UTC timestamp", () => {
    // 2026-10-05T20:00:00Z is 2026-10-06T04:00:00 in Asia/Kuala_Lumpur (UTC+8)
    expect(getKlDateString(new Date("2026-10-05T20:00:00.000Z"))).toBe("2026-10-06");
  });

  test("defaults to the current time when no argument is given", () => {
    expect(getKlDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidDateString", () => {
  test("accepts a real calendar date in YYYY-MM-DD form", () => {
    expect(isValidDateString("2026-10-06")).toBe(true);
  });

  test("rejects a non-existent calendar date", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
  });

  test("rejects malformed strings", () => {
    expect(isValidDateString("2026-10-6")).toBe(false);
    expect(isValidDateString("06-10-2026")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });
});

describe("isDateNotInFutureKl", () => {
  test("accepts today and any past date in KL, using a fixed 'now'", () => {
    const now = new Date("2026-10-06T10:00:00.000Z"); // 2026-10-06T18:00 KL
    expect(isDateNotInFutureKl("2026-10-06", now)).toBe(true);
    expect(isDateNotInFutureKl("2026-10-05", now)).toBe(true);
  });

  test("rejects a date that is tomorrow in KL even though it's still today in UTC", () => {
    // 2026-10-05T20:00:00Z is already 2026-10-06 in KL, so 2026-10-07 is the future
    const now = new Date("2026-10-05T20:00:00.000Z");
    expect(isDateNotInFutureKl("2026-10-07", now)).toBe(false);
    expect(isDateNotInFutureKl("2026-10-06", now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format/kualaLumpurDate.test.ts`
Expected: FAIL with "Cannot find module './kualaLumpurDate'" (or similar resolution error).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/format/kualaLumpurDate.ts
const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

// en-CA formats as YYYY-MM-DD, which is what we want to persist/compare.
const klDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getKlDateString(date: Date = new Date()): string {
  return klDateFormatter.format(date);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isDateNotInFutureKl(dateString: string, now: Date = new Date()): boolean {
  return dateString <= getKlDateString(now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format/kualaLumpurDate.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format/kualaLumpurDate.ts src/lib/format/kualaLumpurDate.test.ts
git commit -m "Add Asia/Kuala_Lumpur calendar-date utilities"
```

---

### Task 2: Vacancy action types and pure status derivation

**Files:**
- Create: `src/lib/vacancyActions/types.ts`
- Create: `src/lib/vacancyActions/deriveVacancyStatus.ts`
- Test: `src/lib/vacancyActions/deriveVacancyStatus.test.ts`

**Interfaces:**
- Consumes: `getKlDateString` from `@/lib/format/kualaLumpurDate` (Task 1).
- Produces:
  - `IgnoreReason = "language" | "location" | "seniority" | "other"` (`types.ts`).
  - `VacancyActionRow = { id: number; vacancyId: number; action: "applied" | "ignored" | "reset"; ignoreReason: IgnoreReason | null; appliedOn: string | null; createdAt: string }` (`types.ts`).
  - `VacancyStatus = { status: "todo" } | { status: "applied"; appliedOn: string } | { status: "ignored"; reason: IgnoreReason | null; date: string }` (`types.ts`).
  - `deriveVacancyStatus(rows: VacancyActionRow[]): VacancyStatus` (`deriveVacancyStatus.ts`) — pure, no I/O.

  Later tasks (`getVacancyStatuses`, `writeVacancyAction`) import `VacancyActionRow`/`VacancyStatus`/`IgnoreReason` from `@/lib/vacancyActions/types` and `deriveVacancyStatus` from `@/lib/vacancyActions/deriveVacancyStatus`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vacancyActions/deriveVacancyStatus.test.ts
import { describe, expect, test } from "vitest";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { VacancyActionRow } from "./types";

function row(overrides: Partial<VacancyActionRow>): VacancyActionRow {
  return {
    id: 1,
    vacancyId: 1,
    action: "applied",
    ignoreReason: null,
    appliedOn: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveVacancyStatus", () => {
  test("no rows means todo", () => {
    expect(deriveVacancyStatus([])).toEqual({ status: "todo" });
  });

  test("a single applied row carries its appliedOn date", () => {
    const rows = [row({ id: 1, action: "applied", appliedOn: "2026-10-05" })];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "applied", appliedOn: "2026-10-05" });
  });

  test("a single ignored row carries its reason and the KL date of created_at", () => {
    const rows = [
      row({
        id: 1,
        action: "ignored",
        ignoreReason: "location",
        appliedOn: null,
        createdAt: "2026-10-05T20:00:00.000Z", // 2026-10-06 in KL
      }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: "location",
      date: "2026-10-06",
    });
  });

  test("an ignored row with no reason carries a null reason", () => {
    const rows = [row({ id: 1, action: "ignored", ignoreReason: null, appliedOn: null })];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: null,
      date: "2026-10-01",
    });
  });

  test("a latest reset row means todo even if earlier rows say otherwise", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 2, action: "reset", appliedOn: null }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "todo" });
  });

  test("latest is determined by highest id, not by created_at ordering", () => {
    const rows = [
      row({ id: 5, action: "applied", appliedOn: "2026-10-05", createdAt: "2026-10-05T00:00:00.000Z" }),
      // Lower id but a *later* created_at timestamp — id must still win.
      row({ id: 3, action: "reset", appliedOn: null, createdAt: "2026-10-09T00:00:00.000Z" }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({ status: "applied", appliedOn: "2026-10-05" });
  });

  test("rows out of array order are still resolved by highest id", () => {
    const rows = [
      row({ id: 1, action: "applied", appliedOn: "2026-10-01" }),
      row({ id: 3, action: "ignored", ignoreReason: "other", appliedOn: null }),
      row({ id: 2, action: "reset", appliedOn: null }),
    ];
    expect(deriveVacancyStatus(rows)).toEqual({
      status: "ignored",
      reason: "other",
      date: "2026-10-01",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/deriveVacancyStatus.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/vacancyActions/types.ts
export type IgnoreReason = "language" | "location" | "seniority" | "other";

export type VacancyActionRow = {
  id: number;
  vacancyId: number;
  action: "applied" | "ignored" | "reset";
  ignoreReason: IgnoreReason | null;
  appliedOn: string | null;
  createdAt: string;
};

export type VacancyStatus =
  | { status: "todo" }
  | { status: "applied"; appliedOn: string }
  | { status: "ignored"; reason: IgnoreReason | null; date: string };
```

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
    return { status: "applied", appliedOn: latest.appliedOn as string };
  }

  return {
    status: "ignored",
    reason: latest.ignoreReason,
    date: getKlDateString(new Date(latest.createdAt)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/deriveVacancyStatus.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vacancyActions/types.ts src/lib/vacancyActions/deriveVacancyStatus.ts src/lib/vacancyActions/deriveVacancyStatus.test.ts
git commit -m "Add pure vacancy status derivation from action rows"
```

---

### Task 3: Read-side server-only getter

**Files:**
- Create: `src/lib/vacancyActions/getVacancyStatuses.ts`
- Test: `src/lib/vacancyActions/getVacancyStatuses.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient` from `@/lib/supabase/server`; `deriveVacancyStatus` and types from Task 2.
- Produces: `getVacancyStatuses(): Promise<Map<number, VacancyStatus>>` — keyed by `vacancyId`. Not consumed by any other task in this plan (it's for the later UI iteration), but must exist and be tested now per the spec.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vacancyActions/getVacancyStatuses.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { getVacancyStatuses } from "./getVacancyStatuses";

function actionsTable(result: { data: unknown; error: unknown }) {
  return { select: () => ({ order: () => Promise.resolve(result) }) };
}

beforeEach(() => {
  fromMock = vi.fn();
});

describe("getVacancyStatuses", () => {
  test("returns an empty map when there are no action rows", async () => {
    fromMock.mockReturnValue(actionsTable({ data: [], error: null }));

    const statuses = await getVacancyStatuses();

    expect(statuses.size).toBe(0);
  });

  test("groups rows by vacancy_id and derives each vacancy's status independently", async () => {
    fromMock.mockReturnValue(
      actionsTable({
        data: [
          { id: 1, vacancy_id: 10, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" },
          { id: 2, vacancy_id: 20, action: "ignored", ignore_reason: "language", applied_on: null, created_at: "2026-10-02T00:00:00.000Z" },
          { id: 3, vacancy_id: 10, action: "reset", ignore_reason: null, applied_on: null, created_at: "2026-10-03T00:00:00.000Z" },
        ],
        error: null,
      })
    );

    const statuses = await getVacancyStatuses();

    expect(statuses.get(10)).toEqual({ status: "todo" });
    expect(statuses.get(20)).toEqual({ status: "ignored", reason: "language", date: "2026-10-02" });
    expect(statuses.size).toBe(2);
  });

  test("throws a plain Error with the DB message when the query fails", async () => {
    fromMock.mockReturnValue(actionsTable({ data: null, error: { message: "connection refused" } }));

    await expect(getVacancyStatuses()).rejects.toThrow("connection refused");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/getVacancyStatuses.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/vacancyActions/getVacancyStatuses.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { VacancyActionRow, VacancyStatus } from "./types";

export async function getVacancyStatuses(): Promise<Map<number, VacancyStatus>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancy_actions")
    .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rowsByVacancyId = new Map<number, VacancyActionRow[]>();
  for (const row of data ?? []) {
    const mapped: VacancyActionRow = {
      id: row.id,
      vacancyId: row.vacancy_id,
      action: row.action,
      ignoreReason: row.ignore_reason,
      appliedOn: row.applied_on,
      createdAt: row.created_at,
    };
    const group = rowsByVacancyId.get(mapped.vacancyId) ?? [];
    group.push(mapped);
    rowsByVacancyId.set(mapped.vacancyId, group);
  }

  const statuses = new Map<number, VacancyStatus>();
  for (const [vacancyId, rows] of rowsByVacancyId) {
    statuses.set(vacancyId, deriveVacancyStatus(rows));
  }
  return statuses;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/getVacancyStatuses.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vacancyActions/getVacancyStatuses.ts src/lib/vacancyActions/getVacancyStatuses.test.ts
git commit -m "Add server-only getter deriving vacancy statuses from action rows"
```

---

### Task 4: Write-side input validators

**Files:**
- Create: `src/lib/vacancyActions/validation.ts`
- Test: `src/lib/vacancyActions/validation.test.ts`

**Interfaces:**
- Consumes: `isValidDateString`, `isDateNotInFutureKl` from `@/lib/format/kualaLumpurDate` (Task 1); `IgnoreReason` from `@/lib/vacancyActions/types` (Task 2).
- Produces:
  - `isValidVacancyId(value: unknown): value is number`
  - `isValidIgnoreReason(value: unknown): value is IgnoreReason`
  - `isValidAppliedOnDate(value: unknown): value is string` — valid `YYYY-MM-DD` and not in the future in KL.

  Task 5 imports all three from `@/lib/vacancyActions/validation`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vacancyActions/validation.test.ts
import { describe, expect, test } from "vitest";
import { isValidAppliedOnDate, isValidIgnoreReason, isValidVacancyId } from "./validation";

describe("isValidVacancyId", () => {
  test("accepts a positive integer", () => {
    expect(isValidVacancyId(1)).toBe(true);
    expect(isValidVacancyId(42)).toBe(true);
  });

  test("rejects zero, negatives, non-integers, and non-numbers", () => {
    expect(isValidVacancyId(0)).toBe(false);
    expect(isValidVacancyId(-1)).toBe(false);
    expect(isValidVacancyId(1.5)).toBe(false);
    expect(isValidVacancyId("1")).toBe(false);
    expect(isValidVacancyId(null)).toBe(false);
    expect(isValidVacancyId(undefined)).toBe(false);
  });
});

describe("isValidIgnoreReason", () => {
  test("accepts each allowed reason", () => {
    expect(isValidIgnoreReason("language")).toBe(true);
    expect(isValidIgnoreReason("location")).toBe(true);
    expect(isValidIgnoreReason("seniority")).toBe(true);
    expect(isValidIgnoreReason("other")).toBe(true);
  });

  test("rejects anything outside the allowed list", () => {
    expect(isValidIgnoreReason("salary")).toBe(false);
    expect(isValidIgnoreReason("")).toBe(false);
    expect(isValidIgnoreReason(null)).toBe(false);
    expect(isValidIgnoreReason(undefined)).toBe(false);
  });
});

describe("isValidAppliedOnDate", () => {
  test("accepts a valid, non-future KL date string", () => {
    const now = new Date("2026-10-06T10:00:00.000Z");
    expect(isValidAppliedOnDate("2026-10-06", now)).toBe(true);
    expect(isValidAppliedOnDate("2026-10-01", now)).toBe(true);
  });

  test("rejects malformed date strings", () => {
    const now = new Date("2026-10-06T10:00:00.000Z");
    expect(isValidAppliedOnDate("not-a-date", now)).toBe(false);
    expect(isValidAppliedOnDate("2026-02-30", now)).toBe(false);
    expect(isValidAppliedOnDate(null, now)).toBe(false);
  });

  test("rejects a date in the future in KL", () => {
    const now = new Date("2026-10-05T20:00:00.000Z"); // already 2026-10-06 in KL
    expect(isValidAppliedOnDate("2026-10-07", now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/validation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/vacancyActions/validation.ts
import { isDateNotInFutureKl, isValidDateString } from "@/lib/format/kualaLumpurDate";
import type { IgnoreReason } from "./types";

const IGNORE_REASONS: readonly string[] = ["language", "location", "seniority", "other"];

export function isValidVacancyId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isValidIgnoreReason(value: unknown): value is IgnoreReason {
  return typeof value === "string" && IGNORE_REASONS.includes(value);
}

export function isValidAppliedOnDate(value: unknown, now: Date = new Date()): value is string {
  return typeof value === "string" && isValidDateString(value) && isDateNotInFutureKl(value, now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/validation.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vacancyActions/validation.ts src/lib/vacancyActions/validation.test.ts
git commit -m "Add write-side validators for vacancy actions"
```

---

### Task 5: Shared server-only write function with guards

**Files:**
- Create: `src/lib/vacancyActions/writeVacancyAction.ts`
- Test: `src/lib/vacancyActions/writeVacancyAction.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient` (Supabase); `deriveVacancyStatus` (Task 2); `isValidVacancyId`, `isValidIgnoreReason`, `isValidAppliedOnDate` (Task 4); `getKlDateString` (Task 1); `IgnoreReason`, `VacancyActionRow` (Task 2).
- Produces:
  - `WriteVacancyActionInput = { intent: "apply"; vacancyId: number } | { intent: "ignore"; vacancyId: number; reason?: IgnoreReason } | { intent: "undo"; vacancyId: number } | { intent: "editAppliedDate"; vacancyId: number; appliedOn: string }`
  - `WriteVacancyActionResult = { ok: true } | { ok: false; error: string }`
  - `writeVacancyAction(input: WriteVacancyActionInput): Promise<WriteVacancyActionResult>`

  Task 6's four Server Actions each build one `WriteVacancyActionInput` variant and call this function directly.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vacancyActions/writeVacancyAction.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let fromMock: any;
let insertMock: any;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (...args: any[]) => fromMock(...args) }),
}));

import { writeVacancyAction } from "./writeVacancyAction";

function vacanciesTable(result: { data: unknown; error: unknown }) {
  return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }) };
}

function vacancyActionsTable(fetchResult: { data: unknown; error: unknown }) {
  return {
    select: () => ({ eq: () => ({ order: () => Promise.resolve(fetchResult) }) }),
    insert: (row: unknown) => insertMock(row),
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
  fromMock.mockImplementation((table: string) =>
    table === "vacancies" ? vacanciesTable(vacancy) : vacancyActionsTable(actionRows)
  );
}

beforeEach(() => {
  fromMock = vi.fn();
  insertMock = vi.fn();
});

describe("writeVacancyAction validation", () => {
  test("rejects a non-integer or non-positive vacancyId before touching the database", async () => {
    const result = await writeVacancyAction({ intent: "apply", vacancyId: -1 });
    expect(result).toEqual({ ok: false, error: "Invalid vacancy." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("rejects an ignore reason outside the allowed list", async () => {
    mockTables();
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "salary" as any });
    expect(result).toEqual({ ok: false, error: "Invalid ignore reason." });
  });

  test("rejects an invalid or future editAppliedDate date", async () => {
    mockTables();
    const badFormat = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "not-a-date" });
    expect(badFormat).toEqual({ ok: false, error: "Invalid date." });
  });
});

describe("writeVacancyAction vacancy existence", () => {
  test("rejects a vacancyId that doesn't exist", async () => {
    mockTables({ vacancy: { data: null, error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 999 });
    expect(result).toEqual({ ok: false, error: "Vacancy not found." });
  });

  test("returns a safe message when the existence check itself fails", async () => {
    mockTables({ vacancy: { data: null, error: { message: "connection refused" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});

describe("writeVacancyAction guards", () => {
  test("apply is rejected when already applied", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Already marked as applied." });
  });

  test("ignore is rejected when already ignored", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "language" });
    expect(result).toEqual({ ok: false, error: "Already marked as ignored." });
  });

  test("undo is rejected when already todo (no rows)", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "undo", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Nothing to undo." });
  });

  test("editAppliedDate is rejected unless currently applied", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const todo = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(todo).toEqual({ ok: false, error: "Can only edit the date once applied." });

    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const ignored = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-01" });
    expect(ignored).toEqual({ ok: false, error: "Can only edit the date once applied." });
  });
});

describe("writeVacancyAction success paths", () => {
  test("apply from todo inserts an applied row dated today in KL", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      vacancy_id: 1,
      action: "applied",
      applied_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  test("apply from ignored is allowed (re-applying after ignoring)", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "ignored", ignore_reason: "other", applied_on: null, created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
  });

  test("ignore with no reason inserts a null ignore_reason", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "ignored", ignore_reason: null });
  });

  test("ignore with a reason inserts it", async () => {
    mockTables({ actionRows: { data: [], error: null } });
    const result = await writeVacancyAction({ intent: "ignore", vacancyId: 1, reason: "seniority" });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "ignored", ignore_reason: "seniority" });
  });

  test("undo from applied inserts a reset row with no applied_on or ignore_reason", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "undo", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "reset" });
  });

  test("editAppliedDate while applied inserts a new applied row with the given date", async () => {
    mockTables({ actionRows: { data: [{ id: 1, vacancy_id: 1, action: "applied", ignore_reason: null, applied_on: "2026-10-01", created_at: "2026-10-01T00:00:00.000Z" }], error: null } });
    const result = await writeVacancyAction({ intent: "editAppliedDate", vacancyId: 1, appliedOn: "2026-10-03" });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({ vacancy_id: 1, action: "applied", applied_on: "2026-10-03" });
  });
});

describe("writeVacancyAction database failures", () => {
  test("returns a safe message when fetching current action rows fails", async () => {
    mockTables({ actionRows: { data: null, error: { message: "connection refused" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  test("returns a safe message when the insert fails", async () => {
    mockTables({ actionRows: { data: [], error: null }, insertResult: { error: { message: "constraint violation" } } });
    const result = await writeVacancyAction({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/vacancyActions/writeVacancyAction.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getKlDateString } from "@/lib/format/kualaLumpurDate";
import { deriveVacancyStatus } from "./deriveVacancyStatus";
import type { IgnoreReason, VacancyActionRow } from "./types";
import { isValidAppliedOnDate, isValidIgnoreReason, isValidVacancyId } from "./validation";

export type WriteVacancyActionInput =
  | { intent: "apply"; vacancyId: number }
  | { intent: "ignore"; vacancyId: number; reason?: IgnoreReason }
  | { intent: "undo"; vacancyId: number }
  | { intent: "editAppliedDate"; vacancyId: number; appliedOn: string };

export type WriteVacancyActionResult = { ok: true } | { ok: false; error: string };

const SAFE_DB_ERROR = "Something went wrong. Please try again.";

export async function writeVacancyAction(
  input: WriteVacancyActionInput
): Promise<WriteVacancyActionResult> {
  if (!isValidVacancyId(input.vacancyId)) {
    return { ok: false, error: "Invalid vacancy." };
  }

  if (input.intent === "ignore" && input.reason !== undefined && !isValidIgnoreReason(input.reason)) {
    return { ok: false, error: "Invalid ignore reason." };
  }

  if (input.intent === "editAppliedDate" && !isValidAppliedOnDate(input.appliedOn)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = getSupabaseServerClient();

  const { data: vacancy, error: vacancyError } = await supabase
    .from("vacancies")
    .select("id")
    .eq("id", input.vacancyId)
    .maybeSingle();

  if (vacancyError) {
    return { ok: false, error: SAFE_DB_ERROR };
  }
  if (!vacancy) {
    return { ok: false, error: "Vacancy not found." };
  }

  const { data: actionRows, error: fetchError } = await supabase
    .from("vacancy_actions")
    .select("id, vacancy_id, action, ignore_reason, applied_on, created_at")
    .eq("vacancy_id", input.vacancyId)
    .order("id", { ascending: true });

  if (fetchError) {
    return { ok: false, error: SAFE_DB_ERROR };
  }

  const rows: VacancyActionRow[] = (actionRows ?? []).map((row: any) => ({
    id: row.id,
    vacancyId: row.vacancy_id,
    action: row.action,
    ignoreReason: row.ignore_reason,
    appliedOn: row.applied_on,
    createdAt: row.created_at,
  }));

  const currentStatus = deriveVacancyStatus(rows);

  if (input.intent === "apply" && currentStatus.status === "applied") {
    return { ok: false, error: "Already marked as applied." };
  }
  if (input.intent === "ignore" && currentStatus.status === "ignored") {
    return { ok: false, error: "Already marked as ignored." };
  }
  if (input.intent === "undo" && currentStatus.status === "todo") {
    return { ok: false, error: "Nothing to undo." };
  }
  if (input.intent === "editAppliedDate" && currentStatus.status !== "applied") {
    return { ok: false, error: "Can only edit the date once applied." };
  }

  const insertRow =
    input.intent === "apply"
      ? { vacancy_id: input.vacancyId, action: "applied" as const, applied_on: getKlDateString() }
      : input.intent === "ignore"
        ? { vacancy_id: input.vacancyId, action: "ignored" as const, ignore_reason: input.reason ?? null }
        : input.intent === "undo"
          ? { vacancy_id: input.vacancyId, action: "reset" as const }
          : { vacancy_id: input.vacancyId, action: "applied" as const, applied_on: input.appliedOn };

  const { error: insertError } = await supabase.from("vacancy_actions").insert(insertRow);

  if (insertError) {
    return { ok: false, error: SAFE_DB_ERROR };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/vacancyActions/writeVacancyAction.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/vacancyActions/writeVacancyAction.ts src/lib/vacancyActions/writeVacancyAction.test.ts
git commit -m "Add shared server-only write function with status guards"
```

---

### Task 6: Server Actions (apply, ignore, undo, editAppliedDate)

**Files:**
- Modify: `src/app/actions.ts`
- Create: `src/app/actions.test.ts`

**Interfaces:**
- Consumes: `writeVacancyAction`, `WriteVacancyActionResult` from `@/lib/vacancyActions/writeVacancyAction` (Task 5); `revalidatePath` from `next/cache`.
- Produces:
  - `apply(vacancyId: number): Promise<WriteVacancyActionResult>`
  - `ignore(vacancyId: number, reason?: IgnoreReason): Promise<WriteVacancyActionResult>`
  - `undo(vacancyId: number): Promise<WriteVacancyActionResult>`
  - `editAppliedDate(vacancyId: number, appliedOn: string): Promise<WriteVacancyActionResult>`

  These are new exports alongside the existing `runManualSync`; no existing export signature changes.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/actions.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";

let writeVacancyActionMock: any;
let revalidatePathMock: any;

vi.mock("@/lib/vacancyActions/writeVacancyAction", () => ({
  writeVacancyAction: (...args: any[]) => writeVacancyActionMock(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => revalidatePathMock(...args),
}));

import { apply, editAppliedDate, ignore, undo } from "./actions";

beforeEach(() => {
  writeVacancyActionMock = vi.fn();
  revalidatePathMock = vi.fn();
});

describe("apply", () => {
  test("calls writeVacancyAction with intent apply and revalidates on success", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await apply(1);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "apply", vacancyId: 1 });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("does not revalidate on failure", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: false, error: "Already marked as applied." });
    const result = await apply(1);
    expect(result).toEqual({ ok: false, error: "Already marked as applied." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("ignore", () => {
  test("passes the reason through when given", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    await ignore(2, "location");
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "ignore", vacancyId: 2, reason: "location" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("omits the reason when not given", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    await ignore(2);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "ignore", vacancyId: 2, reason: undefined });
  });
});

describe("undo", () => {
  test("calls writeVacancyAction with intent undo and revalidates on success", async () => {
    writeVacancyActionMock.mockResolvedValue({ ok: true });
    const result = await undo(3);
    expect(writeVacancyActionMock).toHaveBeenCalledWith({ intent: "undo", vacancyId: 3 });
    expect(result).toEqual({ ok: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions.test.ts`
Expected: FAIL — `apply`, `ignore`, `undo`, `editAppliedDate` are not exported from `./actions`.

- [ ] **Step 3: Write minimal implementation**

Modify `src/app/actions.ts` by adding these imports and exports (the existing `runManualSync` function and its imports stay exactly as-is):

```ts
// Add to the existing imports at the top of src/app/actions.ts:
import {
  writeVacancyAction,
  type WriteVacancyActionResult,
} from "@/lib/vacancyActions/writeVacancyAction";
import type { IgnoreReason } from "@/lib/vacancyActions/types";

// Add these exports below the existing runManualSync function:
export async function apply(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "apply", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function ignore(
  vacancyId: number,
  reason?: IgnoreReason
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "ignore", vacancyId, reason });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function undo(vacancyId: number): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "undo", vacancyId });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function editAppliedDate(
  vacancyId: number,
  appliedOn: string
): Promise<WriteVacancyActionResult> {
  const result = await writeVacancyAction({ intent: "editAppliedDate", vacancyId, appliedOn });
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}
```

`revalidatePath` is already imported at the top of the file for `runManualSync`, so no new import is needed for it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "Add apply/ignore/undo/editAppliedDate Server Actions"
```

---

### Task 7: BACKLOG Minor — Server Action wiring test (runManualSync)

This resolves the BACKLOG.md item: *"Task 5 (manual sync button): no automated test for the Server Action/button wiring itself (the underlying `runSync("manual")` is tested; the wiring isn't) — `src/app/actions.ts` / `src/app/SyncButton.tsx`."* It adds coverage for the pre-existing `runManualSync` wiring (unrelated to vacancy actions) into the same `actions.test.ts` file Task 6 created.

**Files:**
- Modify: `src/app/actions.test.ts`

**Interfaces:**
- Consumes: `runSync` from `@/lib/sync/runSync` (mocked), `revalidatePath` from `next/cache` (already mocked in this file by Task 6).
- Produces: nothing new (test-only task).

- [ ] **Step 1: Write the failing test**

Add this mock alongside the existing `vi.mock` calls at the top of `src/app/actions.test.ts` (both mocks must be declared before the `import { apply, ... } from "./actions"` line, consistent with how `writeVacancyActionMock` is already set up):

```ts
// Add near the top of src/app/actions.test.ts, alongside the existing vi.mock calls:
let runSyncMock: any;

vi.mock("@/lib/sync/runSync", () => ({
  runSync: (...args: any[]) => runSyncMock(...args),
}));
```

Add `runSync` to the existing import line from `"./actions"`:

```ts
import { apply, editAppliedDate, ignore, runManualSync, undo } from "./actions";
```

Add `runSyncMock = vi.fn();` inside the existing `beforeEach`.

Add this new `describe` block:

```ts
describe("runManualSync", () => {
  test("calls runSync with 'manual' and returns its result on success", async () => {
    const syncResult = {
      messages: 1,
      cards: 1,
      unique: 1,
      inserted: 1,
      skipped: 0,
      warnings: 0,
      parserFailureCount: 0,
      parserFailures: [],
      failures: [],
    };
    runSyncMock.mockResolvedValue(syncResult);

    const response = await runManualSync();

    expect(runSyncMock).toHaveBeenCalledWith("manual");
    expect(response).toEqual({ ok: true, result: syncResult });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  test("returns a safe error message and still revalidates when runSync throws", async () => {
    runSyncMock.mockRejectedValue(new Error("gmail unreachable"));

    const response = await runManualSync();

    expect(response).toEqual({ ok: false, message: "gmail unreachable" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run test to verify it actually exercises the wiring**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS already, since `runManualSync` is pre-existing and unchanged — this task only adds coverage for it. To confirm the new tests aren't vacuous, temporarily delete the `revalidatePath("/")` line inside `runManualSync` in `src/app/actions.ts`, rerun, confirm both new tests in the `runManualSync` describe block now FAIL, then restore the line.

- [ ] **Step 3: No implementation change needed**

`runManualSync` in `src/app/actions.ts` already calls `runSync("manual")` and `revalidatePath("/")` in a `finally` block (pre-existing code, unchanged by this plan). This task is test-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (8 tests — the 6 from Task 6 plus these 2)

- [ ] **Step 5: Remove the resolved BACKLOG.md bullet and commit**

Delete this line from the `## Epic 3 (dashboard) deferred Minor findings — 6 Oct` section of `BACKLOG.md`:

```
- Task 5 (manual sync button): no automated test for the Server Action/button wiring itself (the underlying `runSync("manual")` is tested; the wiring isn't) — `src/app/actions.ts` / `src/app/SyncButton.tsx`.
```

```bash
git add src/app/actions.test.ts BACKLOG.md
git commit -m "Test runManualSync Server Action wiring; resolve BACKLOG Minor"
```

---

### Task 8: BACKLOG Minor — proxy matcher test

This resolves the BACKLOG.md item: *"Task 2 (Basic Auth): no automated test exercises the proxy matcher's `/api/sync` exclusion itself (covered only by a manual build+curl check during review) — `src/proxy.ts`."*

**Files:**
- Create: `src/proxy.test.ts`
- Modify: `BACKLOG.md`

**Interfaces:**
- Consumes: `config` (specifically `config.matcher[0]`) exported from `./proxy`.
- Produces: nothing new (test-only task).

- [ ] **Step 1: Write the failing test**

```ts
// src/proxy.test.ts
import { describe, expect, test } from "vitest";
import { config } from "./proxy";

// Next.js compiles each matcher entry as an anchored regex against the path;
// replicate that here so the test exercises the real exported pattern.
function matches(path: string): boolean {
  return new RegExp(`^${config.matcher[0]}$`).test(path);
}

describe("proxy matcher", () => {
  test("excludes /api/sync and its subpaths from the auth gate", () => {
    expect(matches("/api/sync")).toBe(false);
    expect(matches("/api/sync/")).toBe(false);
  });

  test("still gates ordinary routes, including similarly-named ones", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/vacancies")).toBe(true);
    expect(matches("/api/syncthing")).toBe(true);
  });

  test("excludes Next.js static assets and the favicon", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it would fail against a wrong pattern**

Run: `npx vitest run src/proxy.test.ts`
Expected: PASS already, since `src/proxy.ts` is pre-existing and unchanged — this task only adds coverage. To confirm the test is actually exercising the real logic (not vacuously passing), temporarily change `api/sync` to `api/sink` in `src/proxy.ts`'s `config.matcher`, rerun, confirm the first test now FAILS, then revert the change.

- [ ] **Step 3: No implementation change needed**

`src/proxy.ts` is unchanged. This task is test-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/proxy.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Remove the resolved BACKLOG.md bullet and commit**

Delete this line from the `## Epic 3 (dashboard) deferred Minor findings — 6 Oct` section of `BACKLOG.md`:

```
- Task 2 (Basic Auth): no automated test exercises the proxy matcher's `/api/sync` exclusion itself (covered only by a manual build+curl check during review) — `src/proxy.ts`.
```

```bash
git add src/proxy.test.ts BACKLOG.md
git commit -m "Test the proxy matcher's /api/sync exclusion; resolve BACKLOG Minor"
```

---

### Task 9: Full suite verification

**Files:** none (verification-only).

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all test files pass. Total test count should be 42 (pre-existing) + 8 (Task 1) + 7 (Task 2) + 3 (Task 3) + 7 (Task 4) + 17 (Task 5) + 8 (Task 6's `actions.test.ts`, which ends up with 6 tests from Task 6 plus 2 from Task 7) + 3 (Task 8) = **95 tests** across the files touched by this plan, with zero failures and zero skipped.

- [ ] **Step 2: Confirm no stray changes**

Run: `git status`
Expected: clean working tree (everything already committed task-by-task).

- [ ] **Step 3: Push the branch and stop**

```bash
git push -u origin feat/vacancy-actions
```

Do **not** open a pull request — the user asked to push and stop.

---

## Notes for the executor

- No SQL is written or run anywhere in this plan — `vacancy_actions` already exists with its checks in place, and `service_role` is never asked to `UPDATE` or `DELETE`.
- `.env.local` is never read, printed, or logged by any task; env var names are never needed directly in this plan's code (only `getSupabaseServerClient()` touches them, and it's untouched here).
- There is no UI change in this plan. `getVacancyStatuses()` (Task 3) has no caller yet — that's expected; it's built and tested now so the later UI iteration can import it directly.
