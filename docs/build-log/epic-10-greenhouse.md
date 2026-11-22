# Epic 10: Greenhouse as second vacancy source

Branch: `epic-10-greenhouse`. No schema changes, no SQL. First board: Bybit.

## Decisions (from Q&A)

- Greenhouse is a separate step inside `runSync`, after Gmail. Neither stops the other.
- Greenhouse runs only when `process.env.GREENHOUSE_SYNC_ENABLED === "true"`, read at sync time. Off = skipped, no failure entry.
- One upsert per board, after `uniqueVacancyRows`. `ignoreDuplicates: true`, `onConflict: "source,source_job_id"`.
- One `first_seen_at` (a single `new Date()`) per sync, shared by all boards.
- Counts: Greenhouse passing jobs add to `unique`, `inserted`, `skipped`. `messages` and `cards` stay Gmail-only.
- Gmail crash: record in `failures`, still run Greenhouse, then end the run `status: "error"` and rethrow (route returns 500 for `SyncDatabaseError`, as today).
- Board failure (network, non-200, bad JSON, no `jobs` array, 10 s timeout): soft entry in `failures`, other boards still write.
- DB error on a board upsert: throw `SyncDatabaseError`. The `sync_runs` row is still written with the counts so far.
- `/api/sync` has no `maxDuration`. Vercel default is 300 s. 10 s timeout per board, sequential boards: fine. No change.

## Deviation: failure shape (needs your OK)

You asked for `{ messageId: null, jobId: null, board, reason }`, with a fallback if the UI change is more than one line. It is. `messageId` is printed in `src/app/page.tsx` (two places) and `src/app/SyncDetails.tsx` (`{item.messageId}`), and the shared type makes `messageId` non-null. So I use the fallback and need zero UI or type changes:

`{ messageId: "greenhouse:bybit", jobId: null, reason }`

Existing UI prints `greenhouse:bybit (reason)`. Say so if you prefer the `board` field plus a small UI helper (3 one-line edits: `page.tsx` x2, `SyncDetails.tsx`).

## Files

New
- `src/config/greenhouseBoards.ts`: `GREENHOUSE_BOARDS: { identifier, displayName }[]`, one entry `bybit`.
- `src/config/greenhouseFilter.ts`: `INCLUDE_TITLE_TERMS`, `EXCLUDE_TITLE_TERMS` (incl. `Internship`), `LOCATION_PLACES`, `LOCATION_EXACT` (`malaysia`), `LOCATION_REMOTE_TERMS` (`malaysia, apac, sea, southeast asia`), `LOCATION_FAIL_TERMS` (`klang`).
- `src/lib/greenhouse/filter.ts`: pure. `passesFilter(title, location)`. Whole-word, case-insensitive, regex-escaped terms, `\b`-style boundaries with whitespace tolerant phrases. In a location part, a fail term beats a pass term. Split on `;`, passes if any part passes. Bare Malaysia = whole trimmed part equals "malaysia".
- `src/lib/greenhouse/fetchBoard.ts`: no server-only imports, no Supabase. `fetchBoardJobs(board, fetchImpl?)` returns normalised rows. Throws on network, non-200, bad JSON, missing `jobs`. 10 s `AbortSignal.timeout`.
- `src/lib/greenhouse/normalize.ts`: raw job to `VacancyRow` (see spec). Title trimmed, inner whitespace collapsed. Location trimmed, `null` if empty. `source_message_id: null`.
- `scripts/greenhouseDryRun.ts`: imports only `src/config`, `src/lib/greenhouse/*` via relative paths. Per board prints total, passing, first five `title | location | url`. Failing board prints the error and continues. Writes nothing, no secrets.
- `package.json`: script `"greenhouse:dry-run": "tsx scripts/greenhouseDryRun.ts"`; devDependency `tsx` (new dev dependency, as agreed).

Changed
- `src/lib/sync/vacancyRows.ts`: `source: "linkedin" | "greenhouse"`, `source_message_id: string | null`.
- `src/lib/sync/runSync.ts`: split the Gmail body into its own try/catch, add the Greenhouse step, merge counts, final error handling per above.
- `.env.example`: add `GREENHOUSE_SYNC_ENABLED=` with a comment that default is off (only `true` enables).
- Other consumers of `source` / `source_message_id` (one grep, `getVacancies.ts` and any `Vacancy` type) updated only if they assume non-null or linkedin.

Untouched: `src/proxy.ts`, `vercel.json`, `next.config`, `SyncButton`, any `.env` file, `samples/`, `scripts/` (other than the new file), `BACKLOG.md`.

## Tests (vitest, plain functions, no component rendering)

`src/lib/greenhouse/filter.test.ts`, title | location, expected:

| Title | Location | Expected |
|---|---|---|
| Data Product Manager | Kuala Lumpur, Malaysia | pass |
| Platform Product Manager | `Kuala Lumpur, Malaysia ` (trailing space) | pass |
| Spot Product Manager | Abu Dhabi, UAE | fail |
| Head of Platform Product | Kuala Lumpur, Malaysia | fail |
| Senior Product Manager | Abu Dhabi, UAE; Kuala Lumpur, Malaysia | pass |
| Product Owner | APAC - Remote, Remote - SEA, Malaysia | pass |
| Product Owner | Germany - Remote, LATAM - Remote, Seattle, WA Remote | fail |
| Product Owner | Klang, Selangor, Malaysia | fail |
| International Product Manager | Kuala Lumpur | pass |
| Junior Product Manager | Kuala Lumpur | fail |
| Product Manager Intern | Kuala Lumpur | fail |
| Product Manager Internship | Kuala Lumpur | fail |
| Associate Product Manager | Kuala Lumpur | pass |
| AI Specialist | Cyberjaya, Selangor | pass |
| Principal AI Agent Development Engineer/Architect | Kuala Lumpur, Malaysia | fail |

Extra filter cases: "sea" does not match "Seattle"; "Intern" does not match "International"; bare "Malaysia" passes but "Malaysia Airlines Hub" part does not via (b); empty/null location fails; case-insensitivity.

`src/lib/greenhouse/normalize.test.ts`: all stored-row fields, `String(id)`, whitespace collapse, empty location to `null`, `url` untouched.

`src/lib/greenhouse/fetchBoard.test.ts` (mock `fetch`): non-200, bad JSON, missing `jobs`, timeout/network error all throw; good payload returns jobs.

`src/lib/sync/runSync.test.ts` additions (existing mocks):
- Env unset: Greenhouse step skipped, `fetch` never called, no failure entry, Gmail result unchanged.
- Env `"true"`, two boards, one fails: failing board in `failures` as `greenhouse:<id>`, the other board's rows upserted, run status `ok`.
- Env `"true"`, Gmail crashes: Greenhouse still runs and writes, `sync_runs` row `status: "error"`, run throws.
- DB error on a Greenhouse upsert: throws `SyncDatabaseError`, `sync_runs` row written with counts so far.
- Second sync adds nothing: the same Greenhouse payload twice, second upsert returns zero rows, so `inserted: 0`, `skipped` equals the unique count; upsert is called with `ignoreDuplicates: true` and `onConflict: "source,source_job_id"`.
- Per-board `uniqueVacancyRows`: duplicate job id inside a board's payload is sent once.
- Counts: Greenhouse adds to `unique`/`inserted`/`skipped`, not `messages`/`cards`.

## Finish checklist

`npm test`, `npm run build`, `npx tsc --noEmit`, `npm run lint`. Then `git status --short` and `git diff origin/main...HEAD --name-only | grep -E 'proxy|SyncButton|vercel|\.env|next\.config'` (expect nothing; `.env.example` matches `\.env`, so I will explain that hit, as you asked for it). One concern per commit: (1) config + filter + normalize + tests, (2) fetchBoard + dry-run + tsx, (3) types + runSync + tests, (4) `.env.example`. Push branch, no merge. Test on a Vercel Preview with the env var set before merging (by you).

## Skipped / out of scope

Cross-source dedupe, closed jobs, descriptions, UI, new tabs, running the dry run against the DB (it never touches it), any DB write from my machine.
