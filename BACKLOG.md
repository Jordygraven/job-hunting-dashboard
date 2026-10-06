# Backlog

- Create the `/privacy` page. It's linked in the Google OAuth consent screen branding and currently 404s.
- Review the `npm audit` warnings (5 high). Do not run `npm audit fix --force` — check each advisory individually first.
- Consider ingesting `jobs-noreply@linkedin.com` recommendation emails later. Different layout from the job-alert emails; out of scope for MVP.
- Store the saved search per vacancy (deferred 5 Oct).
- Paginate vacancy list (deferred 6 Oct).

## Epic 3 (dashboard) deferred Minor findings — 6 Oct

- Task 1 (runSync): `reasonFor()`'s plain-object branch uses an `as any` cast instead of a narrower type guard — `src/lib/sync/runSync.ts`.
- Task 1 (runSync): no test for "some individual messages fail, overall run still succeeds" — `src/lib/sync/runSync.test.ts`.
- Task 2 (Basic Auth): the `Basic ` scheme check is case-sensitive, though RFC 7235 scheme names aren't — `src/lib/auth/basicAuth.ts`.
- Task 3 (vacancy list): no automated test for `getVacancies()` (ordering, null-location passthrough, snake_case→camelCase mapping) — `src/lib/vacancies/getVacancies.ts`.
- Task 3 (vacancy list): table headers have no `scope="col"` — `src/app/page.tsx`.
- Task 3 (vacancy list): no test exercises the null-location/empty-list UI rendering paths — `src/app/page.tsx`.
- Task 4 (sync status/alert): no test at the exact 26-hour stale boundary (only a 27h "clearly stale" case) — `src/lib/sync/getSyncAlert.test.ts`.
- Task 4 (sync status/alert): the 26-hour threshold is duplicated as a magic number between the constant and a hardcoded UI string — `src/lib/sync/getSyncAlert.ts` / `src/app/page.tsx`.
- Task 4 (sync status/alert): heading hierarchy has `<h2>Sync status</h2>` before `<h1>Vacancies</h1>` — `src/app/page.tsx`.
- Task 4 (sync status/alert): `alerts.map(...)` uses the array index as the React key — `src/app/page.tsx`.
- Final review: `layout.tsx` still has the default create-next-app `title`/`description` metadata — `src/app/layout.tsx`.
- Final review: a successful manual sync shows the same counts twice (button result + status panel) — `src/app/SyncButton.tsx` / `src/app/page.tsx`.
- Final review: `SyncFailure` and `SyncRunFailure` are structurally identical `{messageId, reason}` types defined twice — `src/lib/sync/runSync.ts` / `src/lib/sync/syncRunRecord.ts`.
- Final review: `getLatestSyncRun` assigns the untyped Supabase row straight into narrow unions (`trigger`, `status`) with no runtime validation — `src/lib/sync/getLatestSyncRun.ts`.
- Final review: `vitest.config.ts` (tooling) rode along in the `runSync` extraction commit rather than its own commit — noted for the record, already merged as-is.
- Final review: `VERCEL_AUTOMATION_BYPASS_SECRET` is documented in `.env.example` but referenced nowhere in the code (expected — it's for bypassing Vercel's own deployment protection when testing a preview, not app code) — `.env.example`.
- Final review: an unset `DASHBOARD_PASSWORD` correctly denies access but gives a confusing endless-reprompt UX with no "deploy is misconfigured" signal — `src/proxy.ts`.
- Final review: `/api/sync`'s Bearer-token check uses plain `!==` rather than a constant-time comparison, inconsistent with the Basic Auth gate's treatment (this route's auth was explicitly frozen as-is by the plan) — `src/app/api/sync/route.ts`.
- Final review: `/_next/image` is excluded from the Basic Auth gate and is therefore unauthenticated; harmless today since no remote images are configured — `src/proxy.ts`.
- Final review: `SyncButton` passes a client-side wrapper function to `useActionState` rather than the Server Action directly, so the form has no no-JS fallback — `src/app/SyncButton.tsx`.

## Epic 4 (vacancy actions) deferred Minor findings — 6 Oct

- Task 1 (KL date utilities): `KL_TIME_ZONE` is declared independently in both the new `src/lib/format/kualaLumpurDate.ts` and the pre-existing `src/lib/format/kualaLumpurTime.ts` — candidate for consolidation.
- Task 2 (status derivation): `deriveVacancyStatus` uses `latest.appliedOn as string` instead of runtime-safe narrowing — latent risk if an "applied" row ever has a null `appliedOn` — `src/lib/vacancyActions/deriveVacancyStatus.ts`.
- Task 4 (validators): `IGNORE_REASONS` is typed `readonly string[]` instead of being tied to the `IgnoreReason` union, so a typo'd literal wouldn't be caught at compile time — `src/lib/vacancyActions/validation.ts`.
- Task 5 (write function): the `insertRow` variable's type annotation is wider than a discriminated union, so it no longer prevents pairing the wrong field with the wrong action at compile time (runtime is correct today — each branch is a fixed literal) — `src/lib/vacancyActions/writeVacancyAction.ts`.
- Task 5 (write function): no `import "server-only"` guard on the two modules that reach the service-role Supabase client — `src/lib/vacancyActions/writeVacancyAction.ts` / `src/lib/vacancyActions/getVacancyStatuses.ts`.
- Task 5 (write function): `getSupabaseServerClient()` inside `writeVacancyAction` is uncaught — a missing env var rejects the promise instead of returning `{ok:false, error}`; the future UI task must handle a rejected Server Action, not just a `{ok:false}` result — `src/lib/vacancyActions/writeVacancyAction.ts`.
- Task 5 (write function tests): Supabase mocks ignore query arguments (`.eq()`/`.order()` accept anything and return a fixed result), so a wrong `vacancy_id` filter wouldn't be caught by the suite — `src/lib/vacancyActions/writeVacancyAction.test.ts`.
- Task 5 (write function tests): the four guard-rejection tests don't assert the insert was skipped — an implementation that returned the right error but still inserted would pass — `src/lib/vacancyActions/writeVacancyAction.test.ts`.
- Task 6 (Server Actions tests): only `apply` has a test asserting `revalidatePath` is NOT called on failure; `undo` and `editAppliedDate` don't have the equivalent test — `src/app/actions.test.ts`.
- Final review: `getVacancyStatuses` and `writeVacancyAction` duplicate the identical snake_case-to-camelCase `vacancy_actions` row mapping — extract a shared mapper — `src/lib/vacancyActions/getVacancyStatuses.ts` / `src/lib/vacancyActions/writeVacancyAction.ts`.
- Final review: this branch adds 13 new ESLint `no-explicit-any` errors (not build-gating — `next build` no longer runs ESLint — but worth cleaning up) — mostly in test files, one in `src/lib/vacancyActions/writeVacancyAction.ts`'s row-mapping function.
- Final review: `src/app/actions.test.ts`'s test named "returns a safe error message and still revalidates when runSync throws" actually asserts raw `error.message` passthrough for the pre-existing `runManualSync` (frozen, unchanged behavior) — the name is misleading since it reads as a verified safety guarantee the test doesn't provide. Consider renaming and/or scrubbing the underlying raw-message passthrough later.
- Final review: `vacancy_actions`'s schema has no non-executable reference committed in the repo, unlike this project's convention of keeping SQL in a file — several of this feature's correctness arguments rest on DB CHECK constraints that aren't verifiable from the codebase alone. Consider adding a reference doc (e.g. `docs/schema/vacancy_actions.sql`, non-executable, for documentation only).
