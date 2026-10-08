# Backlog

- `braces` (via `eslint-config-next` → `fast-glob` → `micromatch`) has a high-severity stack-exhaustion advisory with no fixed version available upstream (3.0.3 is latest and still flagged). Dev-only; lint only runs on our own files. Recheck when `eslint-config-next` updates its `fast-glob`/`micromatch` chain.
- Consider ingesting `jobs-noreply@linkedin.com` recommendation emails later. Different layout from the job-alert emails; out of scope for MVP.
- Store the saved search per vacancy (deferred 5 Oct).
- Paginate vacancy list (deferred 6 Oct).

## Epic 3 (dashboard) deferred Minor findings — 6 Oct

- Task 4 (sync status/alert): no test at the exact 26-hour stale boundary (only a 27h "clearly stale" case) — `src/lib/sync/getSyncAlert.test.ts`.
- Final review: `layout.tsx` still has the default create-next-app `title`/`description` metadata — `src/app/layout.tsx`.
- Final review: a successful manual sync shows the same counts twice (button result + status panel) — `src/app/SyncButton.tsx` / `src/app/page.tsx`.
- Final review: `vitest.config.ts` (tooling) rode along in the `runSync` extraction commit rather than its own commit — noted for the record, already merged as-is.
- Final review: `VERCEL_AUTOMATION_BYPASS_SECRET` is documented in `.env.example` but referenced nowhere in the code (expected — it's for bypassing Vercel's own deployment protection when testing a preview, not app code) — `.env.example`.
- Final review: an unset `DASHBOARD_PASSWORD` correctly denies access but gives a confusing endless-reprompt UX with no "deploy is misconfigured" signal — `src/proxy.ts`.
- Final review: `/_next/image` is excluded from the Basic Auth gate and is therefore unauthenticated; harmless today since no remote images are configured — `src/proxy.ts`.
- Final review: `SyncButton` passes a client-side wrapper function to `useActionState` rather than the Server Action directly, so the form has no no-JS fallback — `src/app/SyncButton.tsx`.

## Epic 4 (vacancy actions) deferred Minor findings — 6 Oct

- Task 1 (KL date utilities): `KL_TIME_ZONE` is declared independently in both the new `src/lib/format/kualaLumpurDate.ts` and the pre-existing `src/lib/format/kualaLumpurTime.ts` — candidate for consolidation.
- Final review: this branch adds 13 new ESLint `no-explicit-any` errors (not build-gating — `next build` no longer runs ESLint — but worth cleaning up); 12 remain, in test files (the 13th, in `writeVacancyAction.ts`'s row-mapping function, was resolved 7 Oct by extracting a shared mapper).
- Final review: `src/app/actions.test.ts`'s test named "returns a safe error message and still revalidates when runSync throws" actually asserts raw `error.message` passthrough for the pre-existing `runManualSync` (frozen, unchanged behavior) — the name is misleading since it reads as a verified safety guarantee the test doesn't provide. Consider renaming and/or scrubbing the underlying raw-message passthrough later.
- Final review: `vacancy_actions`'s schema has no non-executable reference committed in the repo, unlike this project's convention of keeping SQL in a file — several of this feature's correctness arguments rest on DB CHECK constraints that aren't verifiable from the codebase alone. Consider adding a reference doc (e.g. `docs/schema/vacancy_actions.sql`, non-executable, for documentation only).

## Step 2 (triage UI) — 7 Oct

- Final review: this branch adds roughly 13-14 more ESLint `no-explicit-any` errors (not build-gating), concentrated in new/restructured test files — `src/app/VacancyActions.test.tsx`, `src/lib/vacancies/getVacancies.test.ts`, `src/lib/vacancyActions/getVacancyTabData.test.ts`, `src/lib/vacancyActions/writeVacancyAction.test.ts`.
- Final review: `deriveVacancyStatus`'s new throw-on-invariant-violation (a latest "applied" row with null `appliedOn`) now sits behind a real caller (page load) for the first time, and a trip there 500s the whole `/` route (sync panel + all four tabs), same as any other DB-read error already did before this branch. Non-blocking — the DB CHECK constraint makes it practically unreachable — but if per-row degradation is ever wanted instead of page-wide failure, this is where to start.
- Final review (repo convention): this plan's own sample test code omitted `afterEach(() => cleanup())` from `@testing-library/react` in two separate new `// @vitest-environment jsdom` test files; both had to be fixed independently to make the plan's own tests pass. This repo has no global test cleanup configured, so any future jsdom test file needs this hook added by hand.

## Epic 5 (search filters) whole-branch review findings — 7 Oct

Found during Epic 6's whole-branch review; pre-existing in Epic 5's work, out of scope for Epic 6, deferred here instead of fixed in-place.

- `getVacances.ts`'s keyset-pagination cursor interpolates `after.first_seen_at` raw into a PostgREST `.or()` filter string instead of a parameterized filter, unlike the sibling `getVacancyStatuses.ts`'s safe `.lt("id", after.id)` form — `src/lib/vacancies/getVacancies.ts`.
- `VacancyFilterBar`'s `formKey` includes `view`, so switching tabs force-remounts the uncontrolled search form and silently discards any text typed into Search but not yet submitted — `src/app/VacancyFilterBar.tsx`.
- The rule "status filtering only applies on the `all` tab" is hardcoded independently in three places (`vacancyLinks.ts`, `vacancyTabs.ts`'s `resolveStatusFilter`, `VacancyFilterBar.tsx`) instead of defined once.
- `VacancyTabs`, `VacancyPagination`, and `VacancyFilterBar` each redeclare the identical 7-9 field filter prop bag from scratch instead of sharing one type (e.g. the existing `VacancyHrefParams` in `vacancyLinks.ts`).
- `getVacancyTabData.ts`: status filtering is applied as a separate `.filter()` step outside the `VacancyFilters`/`matchesVacancyFilters` mechanism, so tab-count badges (computed before the status filter runs) never reflect the status filter while every other filter does. Covered by an existing test documenting this as deliberate — flagged here as a design asymmetry worth a deliberate look, not necessarily a bug.
- `fetchAllRows.ts` now only stops paginating on a genuinely empty page instead of a short page, costing one extra round trip per call even when all data fits on one page — intentional per its own tests, but a cheaper fix (request `SUPABASE_MAX_ROWS + 1`, treat `<= SUPABASE_MAX_ROWS` as the last page) would avoid the extra round trip.
