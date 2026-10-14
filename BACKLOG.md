# Backlog

- `braces` (via `eslint-config-next` → `fast-glob` → `micromatch`) has a high-severity stack-exhaustion advisory with no fixed version available upstream (3.0.3 is latest and still flagged). Dev-only; lint only runs on our own files. Recheck when `eslint-config-next` updates its `fast-glob`/`micromatch` chain.
- Consider ingesting `jobs-noreply@linkedin.com` recommendation emails later. Different layout from the job-alert emails; out of scope for MVP.
- Store the saved search per vacancy (deferred 5 Oct).
- Paginate vacancy list (deferred 6 Oct).
- Epic 9: Applied tab actions get wide with Rejected and Success buttons, consider a compact action menu.

## Epic 3 (dashboard) deferred Minor findings — 6 Oct

- Task 4 (sync status/alert): no test at the exact 26-hour stale boundary (only a 27h "clearly stale" case) — `src/lib/sync/getSyncAlert.test.ts`.
- Final review: a successful manual sync shows the same counts twice (button result + status panel) — `src/app/SyncButton.tsx` / `src/app/page.tsx`.
- Final review: `vitest.config.ts` (tooling) rode along in the `runSync` extraction commit rather than its own commit — noted for the record, already merged as-is.
- Final review: `VERCEL_AUTOMATION_BYPASS_SECRET` is documented in `.env.example` but referenced nowhere in the code (expected — it's for bypassing Vercel's own deployment protection when testing a preview, not app code) — `.env.example`.
- Final review: an unset `DASHBOARD_PASSWORD` correctly denies access but gives a confusing endless-reprompt UX with no "deploy is misconfigured" signal — `src/proxy.ts`.
- Final review: `/_next/image` is excluded from the Basic Auth gate and is therefore unauthenticated; harmless today since no remote images are configured — `src/proxy.ts`.
- Final review: `SyncButton` passes a client-side wrapper function to `useActionState` rather than the Server Action directly, so the form has no no-JS fallback — `src/app/SyncButton.tsx`.

## Epic 4 (vacancy actions) deferred Minor findings — 6 Oct

- Task 1 (KL date utilities): `KL_TIME_ZONE` is declared independently in both the new `src/lib/format/kualaLumpurDate.ts` and the pre-existing `src/lib/format/kualaLumpurTime.ts` — candidate for consolidation.
- Final review: `src/app/actions.test.ts`'s test named "returns a safe error message and still revalidates when runSync throws" actually asserts raw `error.message` passthrough for the pre-existing `runManualSync` (frozen, unchanged behavior) — the name is misleading since it reads as a verified safety guarantee the test doesn't provide. Consider renaming and/or scrubbing the underlying raw-message passthrough later.
- Final review: `vacancy_actions`'s schema has no non-executable reference committed in the repo, unlike this project's convention of keeping SQL in a file — several of this feature's correctness arguments rest on DB CHECK constraints that aren't verifiable from the codebase alone. Consider adding a reference doc (e.g. `docs/schema/vacancy_actions.sql`, non-executable, for documentation only).

## Epic 8 (look and feel + sorting) — 9 Oct

- The "Ignore with reason" select's chevron icon is a hardcoded hex (`#a1a1ab`) in an inline SVG data URI rather than a token reference — `background-image` can't use `currentColor`/CSS vars directly, so if `--text-secondary` changes later, the chevron won't follow it. — `src/app/VacancyActions.tsx`.
- Table rows use `border-collapse: separate` + `border-spacing-y` with per-cell `rounded-l-md`/`rounded-r-md` for the card look — this is a known CSS quirk area (row hover background can show seams at cell boundaries in some browsers). Worth a visual check on the Preview deploy; not verifiable from code alone. — `src/app/VacancyTable.tsx`.

## Step 2 (triage UI) — 7 Oct

- Final review: `deriveVacancyStatus`'s new throw-on-invariant-violation (a latest "applied" row with null `appliedOn`) now sits behind a real caller (page load) for the first time, and a trip there 500s the whole `/` route (sync panel + all four tabs), same as any other DB-read error already did before this branch. Non-blocking — the DB CHECK constraint makes it practically unreachable — but if per-row degradation is ever wanted instead of page-wide failure, this is where to start.
- Final review (repo convention): this plan's own sample test code omitted `afterEach(() => cleanup())` from `@testing-library/react` in two separate new `// @vitest-environment jsdom` test files; both had to be fixed independently to make the plan's own tests pass. This repo has no global test cleanup configured, so any future jsdom test file needs this hook added by hand.

