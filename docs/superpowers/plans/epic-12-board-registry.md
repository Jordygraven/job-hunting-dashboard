# Epic 12: Board registry

Branch `epic-12-board-registry`. Move Greenhouse boards from `src/config/greenhouseBoards.ts` into Supabase so adding a board needs no deploy. The daily sync reads the table, fetches only the boards that are due, and logs every fetch in an append-only table.

## Findings from reading code
- `GREENHOUSE_BOARDS` is imported for real by `runSync.ts:10`, `getSyncVacancies.ts:1` and `scripts/greenhouseDryRun.ts:2`. `fetchBoard.ts`, `normalize.ts`, `processBoard.ts` import only the `GreenhouseBoard` type. Tests: `runSync.test.ts:27` mocks the module, `getSyncVacancies.test.ts:2` uses the real one and holds the unique-name test (lines 113-118).
- Files under `src/lib/greenhouse/` import with relative paths (`../../config/...`) because `scripts/greenhouseDryRun.ts` runs under `tsx` with no `@/` alias. New type imports there must stay relative.
- `fetchBoardJobs` throws `new Error("HTTP " + status)` for any non-200 (`fetchBoard.ts:19`). A 404 is only visible as message text.
- `syncGreenhouse` (`runSync.ts:189-223`) catches fetch errors per board, but `upsertRows` (line 221) is not caught. A database error leaves the loop, so later boards get no `source_results` entry. This is the BACKLOG.md line 41 bug.
- `SourceResult` (`syncRunRecord.ts:16-23`) is a plain interface. `mapSyncRunRow` casts `row.source_results` without rebuilding entries (`getRecentSyncRuns.ts:63`), so an extra optional key passes through with no schema change. `source_results` is `jsonb`.
- `vacancies.company` holds the display name. `getSyncVacancies` finds the display name by `entry.board` (the identifier) and filters `source` and `company` (`getSyncVacancies.ts:41-47`). Identifiers are only unique per portal, so the table read must filter `portal = 'greenhouse'`.
- No timing is logged today and no `maxDuration` is set. `vercel.json` holds only the cron (`0 23 * * *`).
- Vercel docs (page last updated 2026-08-24, fetched in the planning session): with Fluid Compute (on by default) the Hobby default and maximum duration are both 300 s. In Next.js App Router the setting is `export const maxDuration = <seconds>` in the route file. The fetch timeout per board is 10 s (`fetchBoard.ts:4`) and boards run one after another, so the worst case is 30 boards at full timeout. Typical Greenhouse replies are far faster; Task 1 measures it.
- Latest-row pattern to copy: `getVacancyFlags.ts` pages a whole append-only table with `fetchAllRows` (id descending), then groups in a `Map`; the first row seen per key is the latest. Insert-only write pattern: `writeVacancyAction.ts:198-200`.
- `probe-output/boards-found.csv` has 164 data rows. A rough count with plain comma splitting gives about 60 greenhouse rows with `total_jobs` at least 1 and `match_check` `ok`. One greenhouse row has a quoted comma in `board_name`, so the import script needs a real CSV parser, not comma splitting. The probe only writes `ok` or `check`. A read-only count with Python's `csv` module (2026-10-15): 71 greenhouse rows; 2 dropped for `total_jobs` 0, 3 dropped for `match_check` `check`; **66 importable** Greenhouse boards. The three named-company drops (`Remote.com`, `WIZ.AI`, `Gate.io`) matched none of them at that point; the script still applies them.

## Rules for the build
- A board's status is its latest `board_checks` row. A board with no check row counts as `active` (it is fetched). The seed rows for Bybit, Binance and Xendit have no check row.
- `job_count` is nullable: `null` for `not_found` and for by-hand rows; a number for `active` and `empty`.
- Schedule: `active` daily. `empty` only when the latest check is 14 days old or older. `dead` never. `not_found`: daily, same as `active`, until a `dead` row exists (the owner inserts `dead` by hand to stop it).
- Empty means the API returned zero jobs, not zero passing the filter.
- The sync writes check rows: `active` (at least 1 job), `empty` (0 jobs), `not_found` (HTTP 404, `job_count` null). A network error, timeout or HTTP 500 is a soft `failures` entry with no check row.
- A board that is not fetched still gets a `source_results` entry: zero counts plus `reason: "not_due" | "dead"`.
- `GREENHOUSE_SYNC_ENABLED` keeps gating the whole Greenhouse step. Set on Production only; never set on Preview. A Preview deploy therefore never runs the sync, so sync logic is verified with `npm test` plus `npm run greenhouse:dry-run`. Preview checks are only for UI work.
- No fallback list. A failed read of the boards table is a loud `failures` entry and the run status is `error`.
- No UPDATE, no DELETE for `service_role` on either table. To change a board's status, the owner inserts a new check row.

## Green-commit rule
Every task commit passes `npm test`, typecheck and build on its own. The last step of each task: run the three and report the result. One concern per commit. Add files by name. Finish the epic with `/ponytail:ponytail-review` on the diff.

## Schema (the owner writes and runs the SQL; Claude creates no migrations)
Task 4 writes this to `docs/sql/epic-12-board-registry.sql`. the owner runs it in the Supabase SQL editor before the code of Task 5 ships.

```sql
-- Epic 12: board registry. Run once, in order.

create table public.boards (
  id           bigint generated always as identity primary key,
  portal       text not null check (portal in ('greenhouse', 'lever', 'ashby', 'breezy')),
  identifier   text not null,
  display_name text not null,
  created_at   timestamptz not null default now(),
  unique (portal, identifier),
  unique (portal, display_name)
);

create table public.board_checks (
  id         bigint generated always as identity primary key,
  board_id   bigint not null references public.boards (id),
  status     text not null check (status in ('active', 'empty', 'not_found', 'dead')),
  job_count  integer check (job_count is null or job_count >= 0),
  checked_at timestamptz not null default now()
);

create index board_checks_board_id_idx on public.board_checks (board_id, id desc);

alter table public.boards enable row level security;
alter table public.board_checks enable row level security;

revoke all on public.boards, public.board_checks from public, anon, authenticated, service_role;
grant select, insert on public.boards, public.board_checks to service_role;

-- The three boards that are live today. Names must match vacancies.company.
-- No check rows on purpose: a board with no check row counts as active.
insert into public.boards (portal, identifier, display_name) values
  ('greenhouse', 'bybit',    'Bybit'),
  ('greenhouse', 'binance',  'Binance'),
  ('greenhouse', 'xendit',   'Xendit')
on conflict do nothing;
```

Check query (run after the SQL above). Expected: 24 privilege rows, and only the `service_role` rows for `SELECT` and `INSERT` show `ok = true` (4 rows true in total); both `rls:` rows show `ok = true`.

```sql
select 'boards' as tbl, r.role_name, p.priv,
       has_table_privilege(r.role_name, 'public.boards', p.priv) as ok
from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)
union all
select 'board_checks', r.role_name, p.priv,
       has_table_privilege(r.role_name, 'public.board_checks', p.priv)
from unnest(array['anon', 'authenticated', 'service_role']) as r(role_name)
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)
union all
select 'rls:' || relname, '-', 'ROW LEVEL SECURITY', relrowsecurity
from pg_class
where oid in ('public.boards'::regclass, 'public.board_checks'::regclass)
order by 1, 2, 3;
```

By-hand statements the owner uses later (not run by the code):

```sql
-- Stop fetching a board:
insert into public.board_checks (board_id, status)
select id, 'dead' from public.boards where portal = 'greenhouse' and identifier = 'example';

-- Bring a dead board back (the newest row wins):
insert into public.board_checks (board_id, status, job_count)
select id, 'active', null from public.boards where portal = 'greenhouse' and identifier = 'example';
```

## Tasks (in order, one session and one commit each unless noted)

### 1. Measure: Hobby limit, `maxDuration`, timing logs, Syncs page check
Preview check: only for the Syncs page render (UI). Sync logic: `npm test`. No SQL.
Files: `src/app/api/sync/route.ts`, `src/lib/sync/runSync.ts`, `src/app/SyncsTable.tsx` (read only, plus `SourceBlock` wherever it is defined), tests `src/lib/sync/runSync.test.ts`, `src/app/SyncsTable.test.tsx`.
- Confirm Fluid Compute is on for the project (the owner: Vercel dashboard, Project Settings, Functions). Docs say Hobby is 300 s default and maximum with it on. Set `export const maxDuration = 300;` in `route.ts`.
- Add a small `timed(label, fn)` helper in `runSync.ts` that logs `sync step <label> <ms>ms` with `console.log`. Wrap the Gmail step (`gmail`) and each board (`greenhouse:<identifier>`). Labels hold only the step name and board identifier. Log the whole run total once.
- Check the Syncs page: read `SourceBlock` and `groupRunProblems`. Does an extra `reason` key on a `source_results` entry, or an entry with all zero counts, break the render or get ignored? Add a `SyncsTable.test.tsx` case that renders a run whose `sourceResults` includes `{source: "greenhouse", board: "x", found: 0, inserted: 0, skipped: 0, failed: 0, reason: "not_due"}`. Report the finding; if the entry looks like an error or a blank block, Task 5 includes the minimal display fix.
- Tests: `runSync.test.ts` asserts the step logs are written for Gmail and each board (spy on `console.log`).
- The Preview deploy never runs the Greenhouse step (flag is Production only), so timing cannot be read there. After Task 10 goes live, the owner reads the step times in the Production Vercel logs. Decision rule: if the whole Greenhouse step takes more than 150 s for the live boards (66 planned), add a batching task. Otherwise do not build batching. The dry run (`npm run greenhouse:dry-run`) prints total elapsed time at the end; that estimate comes first, before go-live. The Production logs confirm it after go-live.

### 2. `fetchBoardJobs` throws an error that carries the HTTP status
Preview check: no (no behaviour change for callers). No SQL.
Files: `src/lib/greenhouse/fetchBoard.ts`, `fetchBoard.test.ts`.
- Add `export class BoardHttpError extends Error { constructor(readonly status: number) { super(\`HTTP ${status}\`); } }` and throw it at line 19. The message stays `HTTP <status>`, so existing failure reasons do not change.
- Tests: 404 throws `BoardHttpError` with `status 404`; 500 with `status 500`; message strings unchanged; network error and invalid JSON still throw plain `Error`.

### 3. Fix: a database error on one board no longer stops the loop
Preview check: no. Verify with `npm test` plus `npm run greenhouse:dry-run`. No SQL. Still reads the config list.
Files: `src/lib/sync/runSync.ts`, `runSync.test.ts`, `BACKLOG.md`.
- In `syncGreenhouse`, wrap `upsertRows` in try/catch per board. On error: push a `failures` entry for that board (`reasonFor(error)`, `source: "greenhouse"`, `board`), remember the first `SyncDatabaseError`, `continue`. After the loop, rethrow the remembered error. `runSync` already pushes it to `problems` and rethrows a `SyncDatabaseError` first at the end (`runSync.ts:304`).
- Every board keeps its `source_results` entry (it is pushed before the fetch, line 205); partial counts from `upsertRows` still land on the entry.
- Tests: two mocked boards, the first board's upsert fails; assert the second board is still fetched and has its entry; assert one failure for the first board; assert the run status is `error` and the thrown error is the `SyncDatabaseError`.
- Delete BACKLOG.md line 41 (the "A Greenhouse database error stops the board loop..." line) in this same commit.

### 4. Tables and readers
Preview check: no. SQL: yes, the owner runs `docs/sql/epic-12-board-registry.sql` (full SQL above) and the check query before Task 5.
Files: new `docs/sql/epic-12-board-registry.sql`; new `src/lib/boards/types.ts`, `getBoards.ts`, `getLatestChecks.ts`, `isDue.ts`; tests `getBoards.test.ts`, `getLatestChecks.test.ts`, `isDue.test.ts`.
- `types.ts`: `Portal`, `Board = {id, portal, identifier, displayName}`, `CheckStatus`, `BoardCheck = {boardId, status, jobCount: number | null, checkedAt}`. Keep `{identifier, displayName}` assignable to what `fetchBoardJobs` and `processBoard` take.
- `getBoards(client, portal)`: selects from `boards` with `.eq("portal", portal)`, paged with `fetchAllRows` (id ascending, keyset). Maps `display_name` to `displayName`.
- `getLatestChecks(client)`: pages `board_checks` with `fetchAllRows` (id descending, same shape as `getVacancyFlags.ts:14-26`), keeps the first row per `board_id` in a `Map<number, BoardCheck>`.
  `// shortcut: reads every check row, about one per board per day; upgrade to a latest-per-board view or per-board limit(1) past about 50,000 rows.`
- `isDue(check, now)` returns `"due" | "not_due" | "dead"`: no check, `active`, `not_found` give `due`; `empty` gives `due` only when `now - checkedAt >= 14 days`; `dead` gives `dead`.
- Tests: `getBoards` filters by portal (fixture with a greenhouse and a lever board, mock filters on `.eq`); `getLatestChecks` keeps the newest row per board; `isDue` at 13 days 23 h, exactly 14 days, 15 days, dead, no check, `not_found`.

### 5. Rewire `runSync` to the table
Preview check: no. Verify with `npm test` plus `npm run greenhouse:dry-run`. Needs Task 4 SQL applied first.
Files: `src/lib/sync/runSync.ts`, `src/lib/sync/syncRunRecord.ts`, new `src/lib/boards/recordBoardCheck.ts`, `src/lib/greenhouse/fetchBoard.ts`, `normalize.ts`, `processBoard.ts` (type import only), tests `runSync.test.ts`, `recordBoardCheck.test.ts`, and `SyncsTable.tsx` only if Task 1 found it needs the display fix.
- `SourceResult` gains `reason?: "not_due" | "dead"`. Comment: "set only when the board was not fetched".
- `fetchBoard.ts`, `normalize.ts`, `processBoard.ts` import `Board` type from `../boards/types` (relative path). The config file stays until Task 9; it stops being imported by `runSync.ts`.
- `syncGreenhouse` reads `getBoards(client, "greenhouse")` and `getLatestChecks(client)` once. If either read throws: push a `failures` entry (`messageId: "boards"`, `source: "greenhouse"`, reason from the error), throw a `SyncDatabaseError`, no fallback list.
- Per board, `isDue`: `not_due` or `dead` gives a zero-count entry with `reason` and no fetch. `due` runs the Task 3 loop.
- After a successful fetch, `recordBoardCheck` inserts `active` (jobs at least 1, `job_count` = jobs length) or `empty` (0 jobs, `job_count` 0). `BoardHttpError` with status 404 inserts `not_found` (`job_count` null) and is also a normal failures entry. Any other error: failures entry only, no check row. A failed check insert: failures entry for that board and remembered `SyncDatabaseError` (Task 3 path).
- `recordBoardCheck(client, input)` is insert-only, pattern of `writeVacancyAction.ts:198-200`. Returns `{ok: true}` or throws; it never reads back.
- Tests (`runSync.test.ts`; replace the `vi.mock("@/config/greenhouseBoards")` with mocks of `getBoards` and `getLatestChecks`): dead board not fetched, entry has `reason: "dead"`; empty board 13 days old gets `not_due`, 14 days old is fetched; 0 jobs writes an `empty` check; 3 jobs writes `active` with `job_count` 3; 404 writes `not_found` and a failure; 500 and a network error write no check and one failure; table read failure gives a failure and status `error`; board with no check row is fetched.
- Add a test: a seeded board with no check row is fetched and gets its first `active` row. Production confirmation (the three seeded boards each get an `active` row) happens in Task 10.

### 6. `getSyncVacancies` reads the boards table
Preview check by the owner: yes, UI only (Syncs page labels; the page reads existing data, no sync needed). Needs Task 4 SQL.
Files: `src/lib/sync/getSyncVacancies.ts`, `getSyncVacancies.test.ts`, plus every caller of `toSourceGroups` (grep first).
- Read `getBoards(client, "greenhouse")` once per call into `Map<identifier, displayName>`. Pass the map to `fetchEntryLines` and `toSourceGroups` in place of the config `find`. Keep `.eq("source", entry.source)` and `.eq("company", name)`.
- A failed boards read throws, like the existing vacancy query errors.
- Tests: update the existing label tests to build the map; new test with two boards that share a display name on different portals (a greenhouse board and a lever board both named "Acme"): the lookup uses only the greenhouse board, the vacancy query still carries `source = greenhouse` and `company = Acme`, and `getBoards` is called with `.eq("portal", "greenhouse")`. Keep the "list-not-available" and `inserted === 0` cases.
- Remove the `GREENHOUSE_BOARDS` import and the old unique-name test in Task 9, not here (this task keeps the test file compiling).

### 7. Import script (no database access)
Preview check: no. No SQL ships with the code; the script writes SQL for Task 10. Verify with `npm test`.
Files: new `scripts/importBoards.mjs`, new `scripts/importBoards.test.mjs` or `src/lib/boards/importBoards.test.ts` (pick the one vitest already picks up; the pure functions are exported from the script, as `board-probe.mjs` does).
- Reads `probe-output/boards-found.csv` with a real CSV parser (a quoted comma exists in `board_name`; no comma splitting; add a parser dependency only if none is installed, else a small RFC 4180 reader with a test). Keeps rows with `portal = greenhouse`, `total_jobs >= 1`, `match_check` equal to `ok` only. No `confirmed` branch. Drops companies `Remote.com`, `WIZ.AI`, `Gate.io` (case-insensitive). Dedupes by `slug`. Display name = `company` column.
- Writes `probe-output/boards-candidates.json`: array of `{portal, identifier, displayName, jobCount}`.
- Writes `probe-output/boards-import.sql`: one statement per board, so existing boards get no extra check row:
  ```sql
  with b as (
    insert into public.boards (portal, identifier, display_name)
    values ('greenhouse', 'slug', 'Company') on conflict do nothing returning id
  )
  insert into public.board_checks (board_id, status, job_count)
  select id, 'active', 12 from b;
  ```
  Single quotes in names are doubled. The file ends with `select count(*) from public.boards;`.
- Prints how many rows were kept, how many were dropped and why (counts per reason). On the current CSV expect 66 kept.
- Tests: quoted comma in `board_name`; `total_jobs` 0 dropped; `check` dropped; the three named companies dropped; apostrophe in a name escaped; duplicate slug kept once.

### 8. Dry run reads `boards-candidates.json` only
Preview check: no (writes nothing, needs no secrets). Verify by running the dry run.
Files: `scripts/greenhouseDryRun.ts`.
- Replace the `GREENHOUSE_BOARDS` import with a read of `probe-output/boards-candidates.json` (`node:fs`). Map each entry to `{identifier, displayName}`. A missing file prints a one-line hint to run the import script and sets `process.exitCode = 1`. No `--from-table`.
- Output format stays as it is today (header per board, totals, first 5 passing, first 5 location-rejected, `FAILED:` lines). Add one line at the end: boards read, boards that failed.
- Test: none (script, no logic beyond the file read). Verify by running `npm run greenhouse:dry-run` against a sample JSON.

### 9. Delete the config file
Preview check: no. No SQL.
Files: delete `src/config/greenhouseBoards.ts`; `getSyncVacancies.test.ts`; `BACKLOG.md`.
- Pre-condition: `grep -rn "greenhouseBoards" src scripts` returns nothing except the file itself and the old unique-name test.
- Remove the old unique-name test (`getSyncVacancies.test.ts:113-118`). The `unique (portal, display_name)` constraint replaces it.
- BACKLOG.md line 39: drop "(test exists)"; the constraint now enforces it.

### 10. Go live (the owner, with Claude reading output only)
Preview check: no (flag is Production only). Go-live is verified on Production.
- Run `npm run greenhouse:dry-run` after Task 7 has written the candidates. the owner reads the output and says OK. Nothing below happens before that OK.
- the owner runs `probe-output/boards-import.sql` in the Supabase SQL editor, then the check query and `select portal, count(*) from public.boards group by 1;`.
- the owner marks any unwanted board `dead` with the by-hand statement above.
- Merge, then trigger a manual sync on Production. Confirm: the three seeded boards (no check row before) each got an `active` row; the rest got `active` rows; a second same-day sync adds another row per active board. Read the step times in the Production logs against the Task 1 decision rule. `GREENHOUSE_SYNC_ENABLED` stays Production only.

## Open items
- C. Hobby cron limits were not on the docs page that was fetched. The current schedule is once a day, which Hobby has allowed so far; the owner confirms in the dashboard.
