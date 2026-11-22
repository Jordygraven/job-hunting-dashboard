# Epic 11: Syncs page

Branch `epic-11-syncs-page`. Move "Recent syncs" and alert details to `/syncs`. Store which source and board found what.

## Findings from reading code
- `layout.tsx` has no header. Add a plain "Syncs" link next to the `<h1>` in `page.tsx`, and a "Back" link on `/syncs`.
- No email text reaches any failure or warning reason. Parser reasons are 3 fixed strings (`linkedin.ts:94,110,130`). Greenhouse invalid reasons are fixed strings built from field names. Gmail and fetch reasons come from `reasonFor(error)` (API/HTTP error messages). Rule for the build: reasons stay as they are; no task adds email text to any reason.
- No warning colour token exists in `globals.css`. Task 4 adds `--status-warning-bg/-fg` under `:root` and `@theme inline` (the only new tokens).
- `SyncDetails.tsx` (and its test) is deleted. `pluralize` moves to `src/lib/format/` or into the new syncs module if still used.
- Existing test "runSync crash before any message is fetched" (`runSync.test.ts:142`) asserts null counts. Task 2 rewrites it (carry-over e).

## Schema (the owner writes and runs the SQL; Claude creates no migrations)
- `vacancies.sync_run_id uuid null` + plain index `vacancies_sync_run_id_idx`
- `sync_runs.run_id uuid null` + unique index `sync_runs_run_id_key`
- `sync_runs.source_results jsonb null`: list of `{source, board?, found, inserted, skipped, failed}`
- `service_role` keeps SELECT and INSERT only. No UPDATE grant is needed (the stamp happens on insert, via the upsert).
- Must be applied before any task is deployed to Preview. Task 1 already selects `run_id` and `source_results` in `getRecentSyncRuns`, and selecting a missing column makes the main page fail. Tests mock the DB, so building the code first is fine.

## Green-commit rule
Every task commit must pass tests, typecheck and build on its own. Order and types are chosen so no task leaves the tree red. Each task's last step: run the three and report the result. If a task cannot stay green without a later task's change, move that change into this task.

## Tasks (in order, one commit each, add files by name)

### 1. Pure sync-run logic (no UI, no DB writes)
Files: `src/lib/sync/syncRunRecord.ts`, `getRecentSyncRuns.ts` (+ new `getSyncRunsPage.ts`), new `syncStatus.ts`, new `groupRunProblems.ts`, new `pageParam.ts`.
- Stored type `SyncRunDetail` gains optional `source?: "linkedin" | "greenhouse"` and `board?: string`. Optional keeps the stored shape valid for old rows and for Task 1, whose writers (`runSync.ts`) do not set them yet. Task 2 makes the writers set both.
- New read-side type `ResolvedSyncRunDetail = SyncRunDetail & { source: "linkedin" | "greenhouse" }`. `SyncRunRecord` uses `ResolvedSyncRunDetail[]` for `failures`, `parserFailures`, `warningDetails`, and gains `runId: string | null`, `sourceResults: SourceResult[] | null`. `getSyncAlert` takes `SyncRunDetail[]`-compatible data, so it stays untouched.
- `mapSyncRunRow` always fills `source` on the read side. Stored `source` wins; otherwise `messageId` starting with `greenhouse:` gives source greenhouse and board = text after the prefix; otherwise linkedin. Stored `board` wins when present. `source_results` null maps to `null`.
- Existing fixtures that build `SyncRunRecord` (`getSyncAlert.test.ts`, `SyncDetails.test.tsx`, others found by typecheck) are updated in this task so typecheck stays green.
- `getSyncStatus(run)`: error / warning / ok per decision 5.
- `groupRunProblems(run)`: returns `{ topLevel: string[], bySource: [{source, board?, failures, parserFailures, warnings}] }`. `topLevel` from `run.error` split on newline. Gmail crash entries and parser/card items go under LinkedIn.
- `clampPage(raw, totalPages)`: invalid or out of range gives nearest valid page (min 1).
- `getSyncRunsPage(page)`: count query, then 5 runs `order id desc`, range by page. Returns `{runs, page, totalPages}`.
- `getSyncAlert` untouched. `getRecentSyncRuns` stays for the main page (latest run only, limit 1 is a possible later cleanup, not now).
- Tests: `getRecentSyncRuns.test.ts` (old/new row mapping), new `syncStatus.test.ts`, `groupRunProblems.test.ts`, `pageParam.test.ts`.

### 2. Sync writes: run ID, stamp, chunking, source_results, one problem rule
Files: `src/lib/sync/runSync.ts`, new `upsertChunks.ts`, `src/app/api/sync/route.ts`, `src/lib/greenhouse/processBoard.ts` (no change expected), `scripts/greenhouseDryRun.ts`, tests `runSync.test.ts`, new `upsertChunks.test.ts`.
- `runSync` creates `crypto.randomUUID()` at start; passes it to `upsertRows(rows, runId)`, which adds `sync_run_id` to each row inside `upsertRows`. `toVacancyRows`, `normalizeJob`, dry run untouched.
- `upsertRows` calls plain `upsertInChunks(rows, 200, upsertChunk)`. Counts per chunk summed. A chunk error throws `SyncDatabaseError`, which carries the counts of the chunks that already completed (`inserted`, `attempted`, set in the constructor; 0 when the first chunk fails). `upsertRows` catches it, adds those counts to the sync totals and `source_results` entry, then rethrows, so `runSync` records them. The error stays `instanceof SyncDatabaseError` and `route.ts` is unchanged by this. Test: 450 rows, chunk 2 fails, thrown error has `inserted` from chunk 1 and the recorded run includes them.
- Failures get `source` and `board`; Greenhouse puts `board.identifier` in `messageId`. Drop the `greenhouse:` prefix.
- `source_results` built per source/board: found (Gmail: unique cards; Greenhouse: `passing` after `uniqueVacancyRows`... flag below), inserted, skipped, failed (count of `failures` entries for that source/board). Greenhouse omitted when flag off. Source list is data, so a new source needs no schema change.
- Problem rule (d): one `problems: unknown[]` list. Gmail crash and Greenhouse crash both pushed. Counts always recorded (e). `error` = reasons joined with `\n`. Rethrow first `SyncDatabaseError` found, else first problem. Removes `if (!crashed)` and the `greenhouseEnabled ? ... : null` counts logic.
- `route.ts`: a non-database error no longer escapes as an unhandled 500. Catch all, return `{error: "sync failed"}` 500 (no detail leak), keep database branch.
- `recordSyncRun` already `console.error`s on insert error and on throw: verified in the code, no change; adds `run_id` and `source_results` columns.
- `greenhouseDryRun.ts`: set `process.exitCode = 1` in the `catch`, loop continues (c).
- Tests: rewrite crash test (counts recorded, `messages: 0`, etc.); add Gmail+Greenhouse both crash; DB error mid-chunks; 450 rows gives 3 chunks; stamp present on every upserted row; `runId` same on rows and `sync_runs`; Greenhouse off omits it from `source_results`.

### 3. Vacancy lists per sync
Files: new `src/lib/sync/getSyncVacancies.ts` (+ test).
- Per page sync with `runId`, `source_results` non-null: one query per source/board, `where sync_run_id = runId and source = X [and company = displayName]`, `limit 100`, ordered by `id`. Columns: title, company, url only. "and N more" = stored `inserted` minus lines shown (never a second count query).
- Pure helper `toSourceGroups(run, vacancies)` merges `source_results` with lists. Old runs (`runId` or `source_results` null) give a dash and "vacancy list not available".
- Never selects more than 5 syncs' worth of data.

### 4. `/syncs` page, banner, main page edit
Files: new `src/app/syncs/page.tsx`, new `SyncsTable.tsx`, `SyncBadge.tsx`, `SyncsPagination.tsx` (+ `.test.tsx` for the presentational parts that can render), `src/app/page.tsx`, `src/app/globals.css`, delete `SyncDetails.tsx` and its test.
- `page.tsx`: "Syncs" link next to `<h1>`; replace red bullet list with one-line banner (same danger tokens) linking to `/syncs` when `alerts.length > 0`; keep "Finished … inserted/skipped" line; "see above" becomes a link to `/syncs`. Remove `alertText` and `SyncDetails`.
- `/syncs`: `export const dynamic = "force-dynamic"`, reads `?page=N`, `clampPage`, calls Task 1 and 3 functions. Open only if `page === 1` and index 0.
- No proxy change; auth covered by existing Basic Auth matcher (verify matcher covers `/syncs` by reading `src/proxy.ts` at build time).

## Layout rules (match existing dark styles; tokens only, no hard-coded colours)
- Container: `max-w-content mx-auto px-6 py-12`, page bg `bg-surface-page`. Panel: `rounded-lg border border-border-subtle bg-surface-panel`.
- Each sync is a native `<details>`; summary row on one line: time (KL, `formatKlDateTime`), trigger, status badge, "N new". A 0-new sync shows "0 new". Expand control is the `<summary>` with a `cursor-pointer` and a chevron that rotates; no JS.
- Rows separated by `border-t border-border-subtle`; first row has no top border. Text `text-sm text-text-secondary` for summary, `text-text-primary` for the title.
- Levels indented: sync, then source (heading `text-xs font-semibold text-text-secondary`, board name after a ` · `), then vacancy lines (`text-xs text-text-muted`). Vacancy line: title, company, "Open" link in `text-accent`, `target="_blank" rel="noreferrer"`.
- Badges: pill `rounded-md px-2 py-0.5 text-xs`. ok = `status-success-*`, warning = new `status-warning-*`, error = `status-rejected-*`. Text label always shown (not colour only).
- Whole-sync problems: top of expanded sync in `danger` tokens. Source problems: under that source, `text-xs text-text-muted`.
- Pagination: plain "Previous / Next / Page X of Y" links, same style as `VacancyPagination`. Back link top left.
- No breakpoints, no light theme.

## Greenhouse grouping
`vacancies` has `source` only; board display name is `company`. Approach: group by `company = displayName` taken from `greenhouseBoards.ts`, restricted to `sync_run_id`. One query per board in `source_results`.
Risks:
1. Renaming a `displayName` later orphans old lists (the stored board identifier no longer maps). Mitigation: show lists for unknown boards under the identifier with a count only; flagged for review.
2. Two boards with the same display name merge lists. Today only `bybit`; add a unique-displayName assertion test on config.
3. A job's `company` is always set from the board, so no Greenhouse row mismatches.
Alternative rejected: a `vacancies.board` column (needs another schema change; out of agreed scope).

## Open point to confirm before build
- "Found" for Greenhouse = jobs passing the filter, counted after `uniqueVacancyRows` (equals `rows.length`). I follow decision 7 literally. Found for Gmail = unique cards.

## Verification questions (answer in final summary)
- a. Does any code still read or write a `greenhouse:` prefix outside the old-row mapper? (grep)
- b. Does each `source_results` entry's `inserted + skipped` equal its `found`, and do the sums equal the run's `inserted`/`skipped`?
- c. With two boards where the first fails, does the dry run print both and exit 1?
- d. With Gmail and Greenhouse both crashing, are both reasons in `error`, counts recorded, and is the `SyncDatabaseError` rethrown if either was one?
- e. Is the crash row's `messages` now the real count (not null) when `GREENHOUSE_SYNC_ENABLED` is off?
- Chunking: with 450 rows, 3 chunks, and a chunk-2 DB error, does the thrown `SyncDatabaseError` carry chunk-1's counts, are they in the recorded `inserted`/`source_results`, and is it still rethrown?
- Green commits: did tests, typecheck and build pass at each task's commit?

## Preview test steps (the owner; Preview shares the prod DB, so syncs are real)
1. Apply the schema SQL to Supabase. Confirm in the table editor the three columns and two indexes exist.
2. Push the branch (the owner decides); open the Preview URL and sign in with Basic Auth.
3. Open `/`: check the title row has a "Syncs" link and the banner appears only when there is an alert.
4. Click "Syncs": land on `/syncs`, page 1, newest sync open, others collapsed. Old syncs show a dash and "vacancy list not available".
5. Click "Sync now" on `/`. Wait for the "Finished…" line.
6. Open `/syncs`: a new top row; check time, trigger `manual`, badge, total new.
7. Expand it: LinkedIn and Bybit entries each show found/inserted/skipped and up to 100 lines; titles, company and links open the right job.
8. Visit `/syncs?page=999`, `?page=0`, `?page=abc`: each shows a valid page, none errors.
9. Visit `/syncs?page=2`: every row collapsed.
10. Layout checks (I cannot see the page): summary fits on one line at your window width; chevron rotates; badge colours are readable on the dark panel; indentation of the three levels is clear; long titles wrap without pushing the link off screen; back link and pagination are aligned with the content width.
11. Run a second sync and confirm the previous top row is now collapsed.

## Reviewer data rules (read-only, check against the diff)
- `sync_run_id` is set only inside `upsertRows`; not in `toVacancyRows`, `normalizeJob`, or the dry run.
- Same `runId` on stamped rows and the `sync_runs` row.
- No UPDATE/DELETE on `vacancies` or `sync_runs`; no migration files; no SQL executed.
- Chunk size 200; counts accumulate across chunks; chunk error throws `SyncDatabaseError` carrying the completed chunks' counts, and those counts reach the recorded run.
- Each commit builds green (tests, typecheck, build).
- Every failure/warning/parser entry has `source`; Greenhouse `messageId` is the board identifier, not prefixed.
- No reason string contains email text or env values; nothing logs `.env.local` values.
- `/syncs` queries select only title, company, url (vacancies) and never raw `.eml` or `samples/`.
- Vacancy queries `limit 100` and run only for the page's 5 syncs.
- `error` column = problems joined by `\n`; counts never null after a crash.
- No hard-coded colours; new tokens only in `globals.css`.
- `getSyncAlert` rules unchanged; `proxy.ts` unchanged.

## BACKLOG.md
At build time, one grep: `grep -n -i "syncs page\|recent syncs" BACKLOG.md`. If a matching line exists, close it. Add: "Epic 11b: 'duplicate' ignore reason and cross-source dedup." Add: "Unique `displayName` per Greenhouse board / add `vacancies.board` if renames become common."
