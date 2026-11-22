# Epic 13: Auto-draft button, pilot tag and Auto-draft queue

## Goal

Add an Auto-draft toggle and a Pilot toggle to each vacancy, backed by insert-only rows in `vacancy_actions` (`automated_draft`, `automated_draft_cleared`, `pilot`, `pilot_cleared`). Add an Auto-draft queue tab (marked, not drafted, not applied) with a pilot badge and a pilot-only filter, plus a display-only "drafted" badge for `automated_draft_done`. The new actions never affect status or star logic. Drafted rows get a green row tint until applied.

## Queue rule

A vacancy is in the Auto-draft queue when its latest automated_draft-family row is automated_draft AND no automated_draft_done row exists for that vacancy at any time AND its derived status is not applied.

"No automated_draft_done row exists at any time" means a drafted vacancy never returns to the queue, even after a new automated_draft row.

The applied check excludes only `applied`. Success and rejected vacancies stay in the queue (if otherwise eligible) and keep the drafted tint.

## Baseline

`npm test`: 50 files, 562 tests passing (before any change). The five action values and the new action values are already in `types.ts` (commit 251bb8e); `STATUS_ACTIONS` stays the explicit five.

## Files expected to change

- `src/lib/vacancyActions/writeVacancyAction.ts`: widen `WriteVacancyActionInput`, `VacancyActionInsertRow`, `VacancyActionInsertPayload`; add guards and switch cases.
- `src/lib/vacancyActions/writeVacancyAction.test.ts`: tests for the four new intents.
- `src/lib/vacancyActions/deriveVacancyStatus.ts`: add `deriveAutoDraft`, `derivePilot`, `deriveDrafted`, `deriveInQueue` (task 1; same latest-by-id pattern as `deriveStarred`).
- `src/lib/vacancyActions/deriveVacancyStatus.test.ts`: tests for the new derivers (task 1) and the status-unchanged test (task 2).
- `src/app/actions.ts`: `toggleAutoDraft`, `togglePilot` server actions.
- `src/app/actions.test.ts`: tests for both.
- `src/app/AutomationToggle.tsx` (new): auto-draft icon toggle, modelled on `StarToggle` (pending state, error under button). Pilot toggle lives in the same file.
- `src/app/AutomationToggle.test.tsx` (new): render, toggle, error shown.
- `src/lib/vacancyActions/getVacancyFlags.ts`: `VacancyFlags` gains `autoDraft`, `pilot`, `drafted`, `queued`.
- `src/lib/vacancyActions/getVacancyFlags.test.ts`: cover the new flags.
- `src/lib/vacancyActions/vacancyTabs.ts`: `VacancyTabRow` gains `autoDraft`, `pilot`, `drafted`, `queued`; new view `autodraft`; `VIEWS`, `selectRowsForView`, `countByView`/`VacancyTabCounts`, `buildVacancyTabRow`, pilot-only resolver.
- `src/lib/vacancyActions/vacancyTabs.test.ts`: view, count, queue-selection, pilot-filter tests.
- `src/lib/vacancyActions/getVacancyTabData.ts`: pass flags through, resolve `pilot` param, include in `hasActiveFilters`.
- `src/lib/vacancyActions/vacancyLinks.ts` and test: `pilot` param on `VacancyHrefParams`/`buildVacancyHref` (only emitted on the `autodraft` view).
- `src/lib/vacancyActions/vacancySort.ts`: `COLUMNS_BY_VIEW.autodraft` entry (task 8; `COLUMNS_BY_VIEW` is a `Record<VacancyTabView, ...>`, so the new view needs an entry).
- `src/app/VacancyTable.tsx` and test: automation column, badges, `EMPTY_STATE_TEXT.autodraft`, widened table.
- `src/app/VacancyTabs.tsx` and test: new "Auto-draft" tab.
- `src/app/VacancyFilterBar.tsx` and test: "Pilot only" toggle on the Auto-draft view.
- `src/app/page.tsx`: pass `pilot` through to the components.

Not touched: `src/proxy.ts`, `SyncButton`, `vercel.json`, `.env*`, `next.config.*`, database/schema.

## Tasks

### 1. Write path for the new action types

- Change: add intents `autoDraft`, `clearAutoDraft`, `pilot`, `clearPilot` to `WriteVacancyActionInput`. Add four insert-row variants (`automated_draft`, `automated_draft_cleared`, `pilot`, `pilot_cleared`) and widen the `action` union in `VacancyActionInsertPayload`. Add pure helpers to `deriveVacancyStatus.ts` next to the guards that use them: `deriveAutoDraft(rows)` (latest of `automated_draft`/`automated_draft_cleared` is `automated_draft`), `derivePilot(rows)` (latest of `pilot`/`pilot_cleared` is `pilot`), `deriveDrafted(rows)` (any `automated_draft_done` row exists), `deriveInQueue(rows)` (the queue rule above; calls the existing `deriveVacancyStatus` for the status check). No status restriction: any status can be marked (star's To do limit does not apply). Guards: `autoDraft` rejects "Already marked for auto-draft." when already marked; `clearAutoDraft` rejects "Not marked for auto-draft." when not marked; same for pilot. Derive flags from the already-fetched `rows`. Insert only.
- Check: unit tests in `deriveVacancyStatus.test.ts` for the four helpers (including a done row before and after the latest `automated_draft`, which must both exclude the vacancy; cleared/re-marked sequences; an applied vacancy excluded); tests in `writeVacancyAction.test.ts` for insert payload and each guard error; `npm run typecheck`.
- Commit: `Add auto-draft and pilot intents and derive helpers`

### 2. deriveVacancyStatus test with draft and pilot rows

- Change: test only. Mix `automated_draft`, `automated_draft_cleared`, `automated_draft_done`, `pilot`, `pilot_cleared` rows into histories (todo, applied, ignored, success, rejected) and assert `deriveVacancyStatus` and `deriveStarred` output is identical to the same history without them.
- Check: new tests pass; `STATUS_ACTIONS` untouched.
- Commit: `Test that draft and pilot rows never change vacancy status`

### 3. Auto-draft toggle server action

- Change: `toggleAutoDraft(vacancyId, marked)` in `actions.ts`: calls `writeVacancyAction` with `clearAutoDraft` when currently marked, else `autoDraft`. Returns `WriteVacancyActionResult`, `revalidatePath("/")` on ok only, errors returned to the caller (no throw swallowing, no silent failure). Blocking: on a vacancy that has an `automated_draft_done` row, both `autoDraft` and `clearAutoDraft` are rejected with `{ ok: false, error: "Already drafted." }` and write nothing. The checks live in the `autoDraft` and `clearAutoDraft` guards in `writeVacancyAction.ts` (use `deriveDrafted` on the already-fetched rows, checked before the marked/not-marked guards), so the server action returns the error as-is and the UI shows it.
- Check: `actions.test.ts` covers ok, error passthrough, no revalidate on error; `writeVacancyAction.test.ts` covers the drafted block for both `autoDraft` and `clearAutoDraft` (error returned, no insert call).
- Commit: `Add auto-draft toggle server action`

### 4. Pilot toggle server action

- Change: `togglePilot(vacancyId, marked)`, same pattern with `pilot` / `clearPilot`.
- Check: same tests as task 3.
- Commit: `Add pilot toggle server action`

### 5. Auto-draft and Pilot buttons on each row

- Change: `AutomationToggle.tsx` with two client components (auto-draft, pilot) following `StarToggle`: `useState` for pending and error, `aria-pressed`, `aria-label`, error text with `role="alert"`. Wire both into `VacancyTable` row (pilot button in the Actions cell or beside the automation icon; the auto-draft button is the icon from task 6). `getVacancyFlags`/`buildVacancyTabRow`/`VacancyTabRow` carry `autoDraft`, `pilot`, `drafted`. Use existing colour tokens only.
- Check: component tests (toggle label flips, error shown on `ok: false`, disabled while pending); `npm run typecheck`.
- Commit: `Add auto-draft and pilot buttons to vacancy rows`

### 6. Automation icon column next to Star

- Change: new header cell "Auto-draft" (visually an icon with `aria-label`/`title` "Auto-draft") right after Star in `VacancyTable`, using `SHRINK_TO_CONTENT` and the same `h-6 w-6` button footprint as the star column. Widen the table: raise the min width of the wrapper/table so the extra column fits without squeezing Title/Company/Location. Add a tooltip/title so the meaning is clear.
- Check: `VacancyTable.test.tsx` asserts the column header and cell exist on every view; manual visual check at desktop width.
- Commit: `Add narrow automation column beside star in vacancy table`

### 7. Pilot badge and pilot-only filter

- Change: "Pilot" `Pill` (existing `Pill` helper, existing tag tokens) in the Title cell when `row.pilot`. Add `pilot` search param, resolved only on the `autodraft` view; `VacancyFilterBar` shows a "Pilot only" checkbox/toggle there; `buildVacancyHref` carries it; `hasActiveFilters` includes it so Clear filters works.
- Check: tests for param resolution, href building, filtering rows to pilots, filter bar rendering.
- Commit: `Add pilot badge and pilot-only filter`

### 8. Auto-draft queue view

- Change: add `"autodraft"` to `VacancyTabView`/`VIEWS`, `{ view: "autodraft", label: "Auto-draft" }` to `TABS`, count in `countByView`, `selectRowsForView` case: `row.queued` (from `deriveInQueue`, the queue rule above). Add `COLUMNS_BY_VIEW.autodraft` in `vacancySort.ts`. Add `EMPTY_STATE_TEXT.autodraft` ("Nothing queued for auto-draft."). Existing `?view=autodraft` pattern; no status filter on this view.
- Check: `vacancyTabs.test.ts` (queue excludes cleared and drafted rows, counts match), `VacancyTabs.test.tsx`, `vacancyLinks.test.ts`, `vacancySort` tests cover the `autodraft` entry.
- Commit: `Add Auto-draft queue view`

### 9. Drafted badge, row tint and disabled button (display only)

- Change:
  - "Drafted" `Pill` shown in the Title cell when `row.drafted`, on every tab including Auto-draft.
  - Row tint: a row with `row.drafted` and `row.status !== "applied"` gets a green tint across the whole row; the badge stays. Once the vacancy is applied the tint is removed. Success and rejected rows keep the tint. Display only. Uses `row.status`, which already comes from `deriveVacancyStatus`, so no new query. Colour: the existing `bg-status-success-bg` token (translucent green, `--status-success-bg` in `globals.css`); it fits, so no new token and `globals.css` is not touched. The tint replaces the row's `bg-surface-row`/`bg-surface-row-starred` class, so it wins over the starred background; the star stays visible in its own column. Hover class unchanged.
  - The Auto-draft button on a drafted row renders disabled with `aria-label="Drafted"` and `title="Drafted"`. No visible text, so the narrow column stays narrow. Matches the server block from task 3. Task 5 still adds the button itself.
  - No write path for `automated_draft_done`.
- Check: `VacancyTable.test.tsx`: badge on a drafted row on every view including `autodraft`, none on others; tint class present for drafted + todo/ignored/success/rejected, absent for drafted + applied and for non-drafted; a drafted + starred row has the tint class and not `bg-surface-row-starred`, and its star is still rendered; Auto-draft button disabled with aria-label and title "Drafted" on drafted rows.
- Check (Preview deploy, not in tests): on the All tab, a drafted row with a Success status shows the Success pill in its own colour, and the pill stays readable on the tint.
- Check (Preview deploy, not in tests): drafted rows are compared with plain rows on the Preview deploy and the tint is judged by eye. Report the result in the dashboard chat, which collects all Preview findings for one fix prompt.
- Commit: `Show drafted badge, row tint and disabled button`

### 10. Checks

- `npm test`, `npm run typecheck`, `npm run build`. Do not fix the lint warning in `SyncButton.tsx`.
- Run `/ponytail:ponytail-review` on the diff before finishing and report what to delete.
- Real-data behaviour tested on a Vercel Preview deploy before merging (per project rules).
- By hand on the Preview deploy, not in tests: the Success pill stays readable on a drafted row's tint (All tab).
- By hand on the Preview deploy, not in tests: drafted rows compared with plain rows, tint judged by eye. Findings go to the dashboard chat.

## Decisions

- Any status can be marked for auto-draft or pilot. The star limit to To do does not apply.
- "Drafted" is permanent once an `automated_draft_done` row exists.
- The queue excludes drafted vacancies for good (see Queue rule). The drafted badge shows on every tab, including Auto-draft.
- Only applied vacancies are excluded from the queue. Success and rejected stay and keep the tint.
- Auto-draft and clear auto-draft on a drafted vacancy are both blocked server-side with "Already drafted."
- Drafted tint wins over the starred background.
