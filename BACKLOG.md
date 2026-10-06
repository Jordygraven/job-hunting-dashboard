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
