# Backlog

- Create the `/privacy` page. It's linked in the Google OAuth consent screen branding and currently 404s.
- Review the `npm audit` warnings (5 high). Do not run `npm audit fix --force` — check each advisory individually first.
- Consider ingesting `jobs-noreply@linkedin.com` recommendation emails later. Different layout from the job-alert emails; out of scope for MVP.
- Store the saved search per vacancy (deferred 5 Oct).
- Paginate vacancy list (deferred 6 Oct).

## Epic 3 (dashboard) deferred Minor findings — 6 Oct

- Task 2 (Basic Auth): the `Basic ` scheme check is case-sensitive, though RFC 7235 scheme names aren't — `src/lib/auth/basicAuth.ts`.
- Task 4 (sync status/alert): no test at the exact 26-hour stale boundary (only a 27h "clearly stale" case) — `src/lib/sync/getSyncAlert.test.ts`.
- Task 4 (sync status/alert): the 26-hour threshold is duplicated as a magic number between the constant and a hardcoded UI string — `src/lib/sync/getSyncAlert.ts` / `src/app/page.tsx`.
- Final review: `layout.tsx` still has the default create-next-app `title`/`description` metadata — `src/app/layout.tsx`.
- Final review: a successful manual sync shows the same counts twice (button result + status panel) — `src/app/SyncButton.tsx` / `src/app/page.tsx`.
- Final review: `getLatestSyncRun` assigns the untyped Supabase row straight into narrow unions (`trigger`, `status`) with no runtime validation — `src/lib/sync/getLatestSyncRun.ts`.
- Final review: `vitest.config.ts` (tooling) rode along in the `runSync` extraction commit rather than its own commit — noted for the record, already merged as-is.
- Final review: `VERCEL_AUTOMATION_BYPASS_SECRET` is documented in `.env.example` but referenced nowhere in the code (expected — it's for bypassing Vercel's own deployment protection when testing a preview, not app code) — `.env.example`.
- Final review: an unset `DASHBOARD_PASSWORD` correctly denies access but gives a confusing endless-reprompt UX with no "deploy is misconfigured" signal — `src/proxy.ts`.
- Final review: `/api/sync`'s Bearer-token check uses plain `!==` rather than a constant-time comparison, inconsistent with the Basic Auth gate's treatment (this route's auth was explicitly frozen as-is by the plan) — `src/app/api/sync/route.ts`.
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
