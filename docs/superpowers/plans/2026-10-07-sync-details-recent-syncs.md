# Epic 6: sync details and recent syncs

**Branch:** `epic-5-search-filters` (continuing in place, no worktree — per instruction)

**Spec:** full spec given in conversation (no separate spec doc). Key decisions made by the user before planning, confirmed via clarifying questions:

- `warning_details` jsonb column already added by hand in production/Preview's shared database (`public.sync_runs.warning_details jsonb not null default '[]'::jsonb`). No migration SQL needed.
- `failures`, `parser_failures`, and the new `warning_details` all get a **uniform shape**: `{messageId, jobId, reason}` (jobId is `null` where it genuinely can't be known — message-level failures, and parser failures where the anchor link itself had no numeric id).
- The dashboard's "latest run" line and the new "Recent syncs" list are backed by **one query** (`limit 10`, newest first) — `getLatestSyncRun` is replaced, not kept alongside a second query.
- While rewriting that query module, add a light runtime guard on `trigger`/`status` (was raw Supabase row → narrow union with no check) — addresses a standing backlog item in the same file.
- Never store email content: `ParseFailure`/`ParseWarning`'s `snippet` field is dropped when mapping to the stored `{messageId, jobId, reason}` shape (failures already did this; warnings currently don't persist at all, so this is new).
- A crashed sync run must save `warning_details` collected so far, exactly like it already does for `failures`/`parser_failures`.

## Current state (for reference, not to be re-derived mid-task)

- `src/lib/parsers/linkedin.ts`: `finalizeCard()` returns `ParseFailure` in two places — once when the anchor has no numeric job id (no `jobId` ever extracted) and once when the card is missing a title/company (here the `jobId` **is** already in scope, just not threaded through). `ParseWarning` is only produced when a card parses successfully but has unrecognized extra lines — `jobId` is always available here via the card.
- `src/lib/sync/parserFailures.ts`: `toParserFailures()` maps `ParseFailure[]` → `{messageId, reason}[]`, dropping `snippet`. No equivalent exists for warnings today — `runSync.ts` only counts them (`warnings += cardWarnings.length`).
- `src/lib/sync/runSync.ts`: defines its own `SyncFailure` (`{messageId, reason}`), duplicating `SyncRunFailure` in `syncRunRecord.ts` (flagged in `BACKLOG.md`). `reasonFor()` has an `as any` cast on the plain-object-with-message branch (also flagged). `recordSyncRun()` already preserves `failures`/`parserFailures` collected before a crash via the `catch` block — `warningDetails` needs the same treatment.
- `src/lib/sync/getLatestSyncRun.ts`: single-row query, assigns the untyped Supabase row straight into `trigger`/`status` unions with no validation (flagged in `BACKLOG.md`). No `id` column selected today.
- `src/lib/sync/getSyncAlert.ts`: `STALE_THRESHOLD_HOURS = 26` is a local const, not exported; `src/app/page.tsx` hardcodes "26 hours ago" in its own string (flagged in `BACKLOG.md` as a duplicated magic number).
- `src/app/page.tsx`: renders the status line with `{latestRun.warnings ?? 0} warnings.` — unconditionally plural. Uses `—` (em dash, U+2014) consistently as a separator elsewhere in this file and in `VacancyTable.tsx`; no actual em-dash defect found, just something to stay consistent with when adding new UI text.

## Commits

### Commit 1 — Unify failure/warning shape; add warning_details end-to-end

**Files:** `src/lib/parsers/linkedin.ts`, `src/lib/sync/parserFailures.ts`, `src/lib/sync/syncWarnings.ts` (new), `src/lib/sync/syncRunRecord.ts`, `src/lib/sync/runSync.ts`, `src/lib/sync/getSyncAlert.ts` (import rename only)

1. `syncRunRecord.ts`: replace `SyncRunFailure` with a single `SyncRunDetail { messageId: string; jobId: string | null; reason: string }`, used for `failures`, `parserFailures`, and the new `warningDetails` field on `SyncRunRecord`. This resolves the `BACKLOG.md` item about `SyncFailure`/`SyncRunFailure` being duplicate types.
2. `linkedin.ts`:
   - `ParseFailure` gains `jobId: string | null`. Anchor-has-no-id branch → `jobId: null`. Missing-title/company branch → `jobId` (already in scope from the regex match).
   - `ParseWarning` gains `jobId: string` (always known — the warning only fires after a card is built). Set from `card.jobId` in the extras-warning branch.
3. `parserFailures.ts`: `toParserFailures()` returns `SyncRunDetail[]`, carrying `jobId` through, still dropping `snippet`. Remove the now-redundant `ParserFailure` type (replaced by `SyncRunDetail`).
4. `syncWarnings.ts` (new): mirrors `parserFailures.ts` — `toSyncWarnings(messageId, warnings: ParseWarning[]): SyncRunDetail[]`, dropping `snippet`.
5. **Old-row compatibility:** this change is purely additive — `jobId` is a new field, nothing existing is dropped or renamed. Rows written before this change have `parser_failures`/`failures` entries with no `jobId` key at all (old shape `{messageId, reason}`); `warning_details` on those rows is `[]` (backfilled by the column's `DEFAULT '[]'` when it was added). Both are handled by rendering `detail.jobId ?? "—"` in `SyncDetails.tsx` (Commit 3) rather than assuming the key exists — no data migration needed. Covered by an old-shape-row test in `getRecentSyncRuns.test.ts` (Commit 3).
5. `runSync.ts`:
   - Drop the local `SyncFailure` type; use `SyncRunDetail` for `failures`.
   - Collect `const warningDetails: SyncRunDetail[] = []` in the same loop that already does `parserFailures.push(...toParserFailures(...))`, pushing `...toSyncWarnings(message.id, cardWarnings)`. Keep the existing `warnings` count (`cardWarnings.length`) unchanged — `warning_details` is additive, not a replacement.
   - `recordSyncRun()` takes `warningDetails: SyncRunDetail[]` and inserts it as `warning_details`. Both the success path and the `catch` block pass `warningDetails` through (same pattern already used for `failures`/`parserFailures`), so a crash preserves whatever was collected before it.
   - `SyncResult` gains `warningDetails: SyncRunDetail[]`.
6. `getSyncAlert.ts`: update the `SyncRunFailure` import to `SyncRunDetail` (mechanical rename, no behavior change).

**Tests:**
- `linkedin.test.ts`: in "reports a failure when a card is missing its company", assert `failures[0].jobId === '1000000006'`. In "reports a failure when the link has no numeric job id", assert `failures[0].jobId === null`. In "keeps the card and warns on an unrecognized badge line" (or the extras-warning equivalent), assert `warnings[0].jobId` equals the parsed card's `jobId`.
- `parserFailures.test.ts`: update the existing `toEqual` to include `jobId: '1000000006'`; add a case for the null-jobId anchor failure.
- `syncWarnings.test.ts` (new): maps a `ParseWarning` to `{messageId, jobId, reason}`, dropping `snippet`; empty array in → empty array out.
- `runSync.test.ts`: extend the existing success-path test (or add one) asserting `result.warningDetails` and the inserted row's `warning_details` match a non-empty `cardWarnings` case; extend the "crash after partial message failures" test (or add a sibling) asserting `warning_details` collected before the crash is still written on the error row.

**BACKLOG.md:** delete "`SyncFailure` and `SyncRunFailure` are structurally identical `{messageId, reason}` types defined twice".

### Commit 2 — Fix runSync minors from backlog

**Files:** `src/lib/sync/runSync.ts`, `src/lib/sync/runSync.test.ts`

1. Replace `reasonFor()`'s `(error as any).message` with a narrow type guard (`function hasMessage(error: unknown): error is { message: unknown }`).
2. Add the missing test: some individual messages fail (fetch/parse) but the overall run still succeeds (status `"ok"`, `failures` non-empty, `inserted` reflects the surviving messages).

**BACKLOG.md:** delete "`reasonFor()`'s plain-object branch uses an `as any` cast..." and "no test for 'some individual messages fail, overall run still succeeds'".

### Commit 3 — Dashboard: Details / Recent syncs, backed by one query

**Files:** `src/lib/sync/getLatestSyncRun.ts` (deleted), `src/lib/sync/getRecentSyncRuns.ts` (new), `src/app/SyncDetails.tsx` (new), `src/app/page.tsx`, `src/lib/sync/getSyncAlert.ts` (export constant)

1. `getSyncAlert.ts`: export `STALE_THRESHOLD_HOURS`.
2. `getRecentSyncRuns.ts` (new, server-only, replaces `getLatestSyncRun.ts`):
   - One query: `.from("sync_runs").select(...).order("created_at", { ascending: false }).limit(10)`, including `id` and `warning_details` (not previously selected).
   - A plain, independently-tested mapping function (raw Supabase row → `SyncRunRecord`) that runtime-checks `trigger` is `"cron" | "manual"` and `status` is `"ok" | "error"`, throwing on anything else — addresses the backlog item about assigning untyped rows into narrow unions.
   - Returns `SyncRunRecord[]` (not `| null`); empty array when there are no runs.
3. `page.tsx`:
   - Replace `getLatestSyncRun()` with `getRecentSyncRuns()`; `const latestRun = recentRuns[0] ?? null` feeds the existing `getSyncAlert`/status-line logic unchanged.
   - Fix "1 warnings" → pluralize based on count.
   - Use `STALE_THRESHOLD_HOURS` in the "more than N hours ago" string instead of the hardcoded `26`.
   - Render `<SyncDetails recentRuns={recentRuns} defaultOpen={alerts.length > 0} />` directly under the existing status paragraph (the existing red alert box and status line are unchanged).
4. `SyncDetails.tsx` (new, server component — no client JS needed):
   - Outer `<details open={defaultOpen}><summary>Details</summary>` wrapping an `<h3>Recent syncs</h3>` and one row per run in `recentRuns`.
   - Each row is its own `<details open={defaultOpen && index === 0}>` with a `<summary>` showing: time (`formatKlDateTime`), trigger, status, inserted, skipped, warnings count, parser failures count, failures count.
   - Row body lists `failures`, `parserFailures`, `warningDetails` — each as `messageId · jobId · reason` (a small shared render helper since all three are now `SyncRunDetail[]`), rendering `jobId ?? "—"` so pre-existing rows without a `jobId` key degrade cleanly instead of showing "undefined"; a list with 0 entries just doesn't render that subsection.
   - Row summary and detail lines use `—` (em dash) as the separator between fields, matching the existing convention in `page.tsx`'s status line and `VacancyTable.tsx`'s empty-value placeholder (e.g. `14:32 (manual) — ok — 5 inserted — 1 skipped`), not a hyphen or pipe.
   - Plain `<details>`/`<summary>` throughout, per instruction — works without JS.

**Tests:**
- `getRecentSyncRuns.test.ts` (new): the extracted row-mapping function tested directly with plain objects (valid row → `SyncRunRecord`; invalid `trigger`/`status` → throws) — no live calls. Includes an **old-shape row** test: `parser_failures`/`failures` entries with no `jobId` key and `warning_details: []`, asserting the mapper passes them through unchanged (no crash, no fabricated `jobId`). A thin test (mocking `@/lib/supabase/server` the same way `runSync.test.ts` does) asserting the query shape: `.limit(10)`, ordered by `created_at` descending.
- No component test for `SyncDetails.tsx` / `page.tsx` — native `<details>` has no logic to unit-test beyond the `defaultOpen` boolean, which is a one-line expression (`alerts.length > 0`) already covered indirectly by `getSyncAlert.test.ts`. Will verify visually (open vs. closed, alert-triggered vs. not) after implementation — no dev server/browser check is strictly required since this is server-rendered static HTML, but I'll sanity-check the rendered output.

**BACKLOG.md:** delete "`getLatestSyncRun` assigns the untyped Supabase row straight into narrow unions (`trigger`, `status`) with no runtime validation" and "the 26-hour threshold is duplicated as a magic number between the constant and a hardcoded UI string".

## Explicitly out of scope

- **"A successful manual sync shows the same counts twice (button result + status panel)"** (`BACKLOG.md`, files `SyncButton.tsx` / `page.tsx`) — confirmed with user: `page.tsx` is touched here, but fixing this needs a behavior decision about `SyncButton.tsx` (not otherwise touched by this task) that wasn't part of the request. Left as-is; backlog line not deleted.
- No non-executable schema reference doc added for `warning_details` (precedent exists for `vacancy_actions`, but wasn't requested — would be scope creep for this task).

## After coding

Whole-branch review (one subagent, per instruction), then push and stop.
