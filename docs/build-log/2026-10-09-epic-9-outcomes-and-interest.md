# Epic 9: Outcomes and Interest

Branch: `epic-9-outcomes-and-interest` (created from up-to-date `main`).

## Context

`vacancy_actions.action` now additionally allows `rejected`, `success`, `starred`, `unstarred`
(the owner added these by hand; no SQL in this epic). A new nullable `outcome_on` (date) column was
also added by hand, required in app code only on `rejected`/`success` rows.

Today the whole feature is driven by one insight: **status is derived from the single row with
the highest `id` for a vacancy** (`deriveVacancyStatus` in
[deriveVacancyStatus.ts](../../../src/lib/vacancyActions/deriveVacancyStatus.ts)). Star is a
second, independent axis using the same `id` sequence but a disjoint set of action values, so it
needs its own "highest id within its own subset" derivation — reusing the same row history,
filtered differently.

## Design decisions

**1. Status and star are two independent filters over the same row history, not two fields set by
different inserts.** Both `deriveVacancyStatus` and a new `deriveStarred` take the *full* row
history for a vacancy and self-filter to their own action subset before taking the highest `id`:

```ts
const STATUS_ACTIONS = ["applied", "ignored", "reset", "rejected", "success"] as const;
const STAR_ACTIONS = ["starred", "unstarred"] as const;
```

This is what makes "a `reset` never clears a star, a star never changes status" true by
construction — a `reset` row is invisible to `deriveStarred`'s filter, and a `starred`/`unstarred`
row is invisible to `deriveVacancyStatus`'s filter. No special-casing needed.

**2. `success`/`rejected` rows do not duplicate `applied_on`.** When status is `success` or
`rejected`, `appliedOn` is recovered by scanning the same filtered status-row history backwards
for the nearest preceding `applied` row (the chain into an outcome is always `applied → success`
or `applied → success → rejected`, so there's always exactly one to find). This avoids storing the
same applied date twice and is what makes "Undo inserts a new `applied` row with the same applied
date" trivial: `writeVacancyAction` already fetches full per-vacancy history, so undo can look up
that same preceding `applied` row's date directly. The alternative (copy `applied_on` onto every
outcome insert) was rejected as redundant.

**3. `getVacancyStatuses` must change from "keep the first (=latest) row per vacancy" to "keep
all rows per vacancy."** It already fetches the *entire* `vacancy_actions` table on every call
(`fetchAllRows` with no `vacancy_id` filter) — the optimization was only in the in-memory
reduction, not the query. Switching that reduction from a single `Map<id, row>` to a
`Map<id, row[]>` costs nothing extra on the DB side and is required because status-latest and
star-latest can now legitimately be two different rows for the same vacancy (e.g. `applied` then
`starred` then `success` — latest status row is `success`, latest star row is `starred`). The
function/file is renamed `getVacancyFlags` returning `Map<number, { status: VacancyStatus; starred: boolean }>`.

**4. Default "starred rows sort first" is one change in `sortRows`'s existing no-sort branch.**
`sortRows` already returns rows unchanged when `sort === null`; that branch becomes a stable sort
on `starred` descending (JS array sort is stable, so relative order within each group is
preserved — same tie-break guarantee the explicit-sort branch already relies on). This applies
uniformly to every tab, which matches "flagged rows show the star on every tab" — no per-view
special-casing required. A header click sets `sort`/`dir`, which bypasses this branch entirely, so
"a header click always wins" falls out for free.

**5. Star is a new, separate table column, not part of `VacancyActions`.** `VacancyActions.tsx`
stays focused on status transitions (Applied/Success/Reject/Undo/Edit dates). A new
`StarToggle.tsx` client component renders in its own column on every tab: an interactive
toggle when `row.status === "todo"`, a static indicator glyph when `row.starred` and status isn't
`todo`, and nothing otherwise.

## Clarifications already settled with the owner

- Tab order: **To do, Interest, Applied, All, Success, Rejected, Ignored.**
- Star control is interactive only on To do rows (To do tab, or To do rows inside All) **and on
  every row of the Interest tab, regardless of status**. On the Interest tab, unstarring any row
  inserts `unstarred` and never touches status — a starred Applied/Success/Rejected/Ignored row
  can be unstarred from Interest without an Undo. Every other tab (To do, Applied, All, Success,
  Rejected, Ignored) shows a static indicator only for non-todo rows — once a starred vacancy
  leaves To do, it can't be unstarred there until Undo returns it to To do, or it's unstarred from
  Interest.
- Extra files beyond the originally-scoped list were approved and read: `deriveVacancyStatus.ts`,
  `mapVacancyActionRow.ts`, `validation.ts`, `getVacancyTabData.ts`, `vacancySort.ts`,
  `getVacancyStatuses.ts` (pulled in transitively — it's what `getVacancyTabData.ts` calls),
  `VacancyActions.tsx`, `VacancyTable.tsx`, `page.tsx`, and `src/app/actions.ts` (pulled in
  transitively — it's what `VacancyActions.tsx` calls).

## Assumptions not yet confirmed (flagging, not blocking)

- The "All"-tab status filter dropdown and the Interest tab's status filter are both extended to
  include `success`/`rejected` (parity, since both mix statuses). Low risk to adjust later.
- Interest tab's `statusFilterAppliesToView` parity with All (so the Interest tab gets the same
  Status dropdown as All). Same reasoning.
- Starred-row highlight styling (new CSS token vs. reusing `accent-muted-bg`) is left as an
  implementation-time call inside `globals.css`'s existing naming convention.

## File-by-file changes

### Data layer (`src/lib/vacancyActions/`)

- **types.ts** — extend `VacancyActionRow["action"]` union with `rejected | success | starred |
  unstarred`; add `outcomeOn: string | null`. Extend `VacancyStatus` with `success`/`rejected`
  variants carrying `appliedOn` + `outcomeOn`. Define `STATUS_ACTIONS`/`STAR_ACTIONS` here as the
  single source of truth (mirrors the existing `IGNORE_REASONS as const satisfies` pattern) so
  `writeVacancyAction.ts` derives its insert-row union from the same list instead of re-declaring
  literals — this directly addresses the original grep finding that only `types.ts` and
  `writeVacancyAction.ts` knew the action values, and keeps it that way deliberately (one shared
  source, two consumers) rather than letting a third copy appear.

- **deriveVacancyStatus.ts** — self-filter to `STATUS_ACTIONS` before taking highest `id`; add
  `success`/`rejected` branches with the backward-scan for `appliedOn` described above. Add
  `deriveStarred(rows)` in the same file (self-filters to `STAR_ACTIONS`, returns
  `latest.action === "starred"`, `false` if no star rows exist).

- **mapVacancyActionRow.ts** — add `outcome_on` to `VacancyActionDbRow` and map it to `outcomeOn`.

- **validation.ts** — add `isValidOutcomeOnDate(value, appliedOn, now)`: valid date string, not in
  the future (KL), and `value >= appliedOn` (safe as plain string comparison since dates are
  `YYYY-MM-DD`, same trick `vacancySort.ts`'s `plainCompareValues` already relies on).

- **writeVacancyAction.ts** — extend `WriteVacancyActionInput` with `markSuccess`, `markReject`,
  `editOutcomeDate`, `star`, `unstar` intents. Guards, mirroring the existing
  apply/ignore/undo/editAppliedDate pattern:
  - `markSuccess`: only from `status === "applied"`.
  - `markReject`: only from `status === "applied" | "success"`.
  - `undo`: unchanged for `applied`/`ignored` (inserts `reset`); **new** — from
    `success`/`rejected`, inserts `applied` with `appliedOn` recovered via the backward-scan.
  - `editOutcomeDate`: only from `status === "success" | "rejected"`; validates via
    `isValidOutcomeOnDate`; same-date is a no-op (mirrors `editAppliedDate`'s existing no-op
    check at line 95-101 today).
  - `star`: only from `status === "todo" && !starred` (needs `deriveStarred(rows)` alongside the
    existing `deriveVacancyStatus(rows)` call — `rows` is already the full per-vacancy fetch, no
    new query).
  - `unstar`: only from `status === "todo" && starred`.
  - New insert-row shapes: `{ action: "success"; outcome_on }`, `{ action: "rejected"; outcome_on }`
    (no `applied_on`, per design decision 2), `{ action: "starred" }`, `{ action: "unstarred" }`.

- **getVacancyStatuses.ts → getVacancyFlags.ts** (rename) — change the reduction from
  "first row seen per vacancy wins" to "collect all rows per vacancy," then call both
  `deriveVacancyStatus` and `deriveStarred` per vacancy. Returns
  `Map<number, { status: VacancyStatus; starred: boolean }>`.

- **getVacancyTabData.ts** — call `getVacancyFlags` instead of `getVacancyStatuses`; thread
  `starred`/`outcomeOn` into `buildVacancyTabRow`; extend counts (see `vacancyTabs.ts` below).

- **vacancyTabs.ts** —
  - `VacancyTabView`: `"todo" | "interest" | "applied" | "all" | "success" | "rejected" | "ignored"`
    (confirmed order).
  - `VacancyTabRow.status`: add `success | rejected`; add `outcomeOn: string | null` and
    `starred: boolean` fields.
  - `VacancyTabCounts`: add `success`, `rejected`, `interest`. `all` stays the sum of the five
    status counts; `interest` is computed separately (count of starred rows in
    `commonFilteredRows`) and never folded into `all`.
  - `STATUS_LABELS`: add `success: "Success"`, `rejected: "Rejected"`.
  - `STATUS_FILTERS` (the All/Interest status dropdown): add `success`, `rejected`.
  - `statusFilterAppliesToView`: `view === "all" || view === "interest"`.
  - `selectRowsForView`: add `success`/`rejected` (filter by status) and `interest` (filter by
    `row.starred`, ignoring status entirely).
  - `buildVacancyTabRow`: accept `starred: boolean` alongside `status`; set `outcomeOn` when
    `status.status` is `success`/`rejected`.

- **vacancySort.ts** —
  - `SortableColumnKey`: add `"outcomeOn"`.
  - `COLUMN_DEFS`: add `outcomeOn` (label "Outcome on", `plainCompareValues`, same pattern as
    `appliedOn`).
  - `COLUMNS_BY_VIEW`: add `interest: [title, company, location, firstSeenAt, status]` (status
    column, per the rule, parity with `all`); `success`/`rejected`:
    `[title, company, location, firstSeenAt, appliedOn, outcomeOn]`. `all`/`todo`/`applied`/
    `ignored` unchanged — "Outcome on is sortable on Success and Rejected" means it's deliberately
    absent elsewhere, including `all`.
  - `sortRows`: change the `sort === null || dir === null` branch from "return rows unchanged" to
    a stable sort on `starred` descending (design decision 4).

- **vacancyLinks.ts** — no logic changes expected; it's generic over `VacancyTabView`/
  `SortableColumnKey`, both widened above. Verify after the other changes land that nothing here
  hardcodes the 4-tab/4-column world.

### App layer (`src/app/`)

- **actions.ts** — add `markSuccess`, `markReject`, `editOutcomeDate`, `star`, `unstar` wrappers
  around `writeVacancyAction`, each calling `revalidatePath("/")` on success (same shape as the
  four existing wrappers).

- **VacancyActions.tsx** — widen `status` prop to include `success | rejected`. Add buttons:
  - `status === "applied"`: add "Success" and "Reject" buttons alongside the existing Ignore/Undo.
  - `status === "success"`: add "Reject" button (Success → Rejected only, no reverse).
  - Extend the existing "Undo" condition to include `success`/`rejected`.
  - Add an "Edit outcome date" affordance for `status === "success" | "rejected"`, mirroring the
    existing `isEditingDate`/`dateValue` state machine for Applied — new state pair, calls
    `editOutcomeDate`. Date input gets `max={getKlDateString()}` (no future) and `min={appliedOn}`
    (client-side mirror of the server-side floor check) like the existing date input's `max`.

- **StarToggle.tsx** (new) — client component, one per row: interactive star/unstar button when
  `status === "todo"` (calls `star`/`unstar` from `actions.ts`); static star glyph when
  `starred && status !== "todo"`; nothing otherwise.

- **VacancyTable.tsx** —
  - `EMPTY_STATE_TEXT`: add `interest`, `success`, `rejected` entries.
  - `STATUS_PILL_CLASS`: add `success`/`rejected` using new tokens (see globals.css below).
  - New Star column (renders `StarToggle`) present on every view, positioned before Title.
  - Header/cell branches for `appliedOn`/`outcomeOn` extended from `view === "applied"` to also
    cover `view === "success" || view === "rejected"` (both columns on both tabs).
  - Status pill column condition extended from `view === "all"` to
    `view === "all" || view === "interest"`.
  - Row background: add the starred accent-highlight class when `row.starred` (and no explicit
    `sort` is active — the highlight is the same "flagged floats up front" affordance, but it
    should probably persist as a visual marker even under an explicit sort; confirm during
    implementation whether the highlight itself is also contingent on "no sort param" or purely on
    `starred` — the written rule ties *sorting* to "no sort param," the *highlight* sentence has
    no such qualifier, so current reading: highlight is unconditional on `starred`, only the
    *position* depends on sort state).

- **VacancyTabs.tsx** — `TABS` array updated to the 7 confirmed tabs/labels, in order.

- **VacancyFilterBar.tsx** — `STATUS_OPTIONS` extended with `success`, `rejected`.

- **page.tsx** — expected no changes; it forwards `getVacancyTabData`'s return generically to
  children. Verify after wiring the above.

- **VacancyPagination.tsx** — not read this round (out of original scope, looked generic/
  `buildVacancyHref`-driven from the files that were read). Verify no changes needed once the new
  views exist; flag if it turns out to hardcode the 4-view world.

- **globals.css** — add `--status-success-bg/fg`, `--status-rejected-bg/fg` tokens (same pattern
  as the existing todo/applied/ignored status tokens) and a starred-row highlight token (new, or
  reuse `accent-muted-bg` — implementation-time call, no hard-coded colours in components either
  way).

## Tests per rule

| Rule | Test location | Cases |
|---|---|---|
| Status = highest id among its 5 actions only; star = highest id among its 2 only; reset never clears star; star never changes status | `deriveVacancyStatus.test.ts` (extend) | Interleaved rows across both subsets; `reset` after `starred` keeps `starred`; `unstarred` after `rejected` keeps status `rejected` |
| Allowed clicks (Applied→Success/Rejected, Success→Rejected); `writeVacancyAction` rejects the rest | `writeVacancyAction.test.ts` (extend) | `markSuccess` from todo/ignored/success/rejected → error; from applied → ok; `markReject` from applied/success → ok; from todo/ignored/rejected → error |
| Undo from Success/Rejected inserts `applied` with the *original* applied date | `writeVacancyAction.test.ts` | applied(A)→success→undo→applied(A); applied(A)→success→rejected→undo→applied(A) (survives two outcome hops) |
| `outcome_on` defaults to today KL, not future, not before applied date | `validation.test.ts` (extend) | today → ok; tomorrow → reject; equal to appliedOn → ok; one day before appliedOn → reject |
| Edit outcome date: same date is a no-op, different date inserts a new row | `writeVacancyAction.test.ts` | same value → no insert, `ok:true`; different value → new row, old row untouched |
| Tabs add up to All; Interest excluded from the sum | `getVacancyTabData.test.ts` / a `vacancyTabs.test.ts` `countByView` case (extend/new) | Mixed vacancies across all 5 statuses with some starred in each → `all === todo+applied+success+rejected+ignored`; `interest === count(starred)`, not added into `all` |
| Success/Rejected show Applied on + Outcome on; Outcome on sortable there only | `vacancySort.test.ts` (extend), `VacancyTable.test.tsx` (extend) | `COLUMNS_BY_VIEW.success`/`.rejected` include `outcomeOn`; `all` does not; header renders a working sort link on those two tabs only |
| Star button only on To do rows (To do tab, or To do rows in All); indicator elsewhere; no unstar control elsewhere | `StarToggle.test.tsx` (new) | status=todo → interactive button; status=applied & starred → static glyph, no button; unstarred & non-todo → nothing |
| Default star-first ordering only with no `sort` param; header click always wins | `vacancySort.test.ts` (extend) | `sortRows(rows, null, null)` → starred first, relative order preserved within each group; `sortRows(rows, "title", "asc")` → ignores `starred` entirely |
| Filters/sorting work on new tabs | `getVacancyTabData.test.ts` (extend) | Existing q/company/from/to-filter test matrix re-run parametrized over `success`, `rejected`, `interest` views |

## Preview checklist

- Apply a vacancy → mark Success: Applied on unchanged, Outcome on defaults to today (KL).
- Mark that Success vacancy Rejected: Applied on still unchanged, Outcome on updates to today.
- Edit outcome date to a future date via the date input → picker caps at today; if bypassed,
  server rejects.
- Edit outcome date to a date before the applied date → rejected with a clear message that states
  the applied date (ideally picker's `min` also prevents it).
- Undo from Success → back to Applied with the *original* applied date, not today.
- Undo from Rejected (reached via Success) → back to Applied with the *original* applied date
  (confirms the backward-scan survives two outcome hops).
- Star a To do vacancy → floats to top of the To do tab with no `sort` param active, shows the
  accent highlight.
- On the Interest tab, unstar an Applied (or Success/Rejected/Ignored) row → row disappears from
  Interest, status is unchanged (confirm on the Applied/All/etc. tab the vacancy still shows its
  original status, just no longer starred).
- Click a column header on a tab with a starred row → explicit sort overrides the starred-first
  default.
- Apply the starred vacancy → still shows starred (static indicator, no button) in Applied and
  All; confirm there's no way to unstar it there.
- Interest tab shows vacancies across every status with a Status column; confirm its count is
  *not* folded into All's displayed total.
- All tab's status filter dropdown includes Success and Rejected and filters correctly;
  spot-check Interest's dropdown too.
- Ignored vacancies show no Success/Reject buttons; confirm the guard also rejects a replayed
  request for one (e.g. via devtools) if easy to test.
- Table overflow/shrink-to-content behaviour (recently fixed) still holds with the new Star and
  Outcome on columns added.
- New success/rejected pills and the starred-row highlight read correctly against the dark theme
  using the new tokens (no hard-coded colours).
