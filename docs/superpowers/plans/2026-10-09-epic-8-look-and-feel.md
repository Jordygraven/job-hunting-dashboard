# Epic 8: Look and Feel + Sorting — Plan

Branch: `epic-8-look-and-feel`. Dark only, desktop only, no new dependencies. Behaviour unchanged except sorting. All 277 existing tests stay green.

## Design tokens

All in `src/app/globals.css`, replacing the current light/dark `--background`/`--foreground` pair. Single dark palette, no `prefers-color-scheme` branch. `:root { color-scheme: dark; }` so native select/date/scrollbar chrome renders dark.

Defined under `:root` and surfaced to Tailwind via `@theme inline` (same pattern already in the file), so components use `bg-surface-panel`, `text-primary`, `border-subtle`, etc. — no hard-coded colours in component files.

| Token | Role |
|---|---|
| `--color-surface-page` | page background |
| `--color-surface-panel` | filter bar / details / card backgrounds |
| `--color-surface-row` | table row background |
| `--color-surface-row-hover` | row hover state |
| `--color-border-subtle` | hairline borders (panels, rows, header rule) |
| `--color-text-primary` | headings, row primary text |
| `--color-text-secondary` | secondary text (company, location, labels) |
| `--color-text-muted` | counts, timestamps, placeholder-ish text |
| `--color-accent` | indigo/violet accent — active tab underline, filled button, focus ring, link icon |
| `--color-accent-foreground` | text on filled accent surfaces |
| `--color-accent-muted-bg` | translucent accent background (ghost hover, accent tag pill bg) |
| `--color-status-todo-bg` / `-fg` | To do tag pill |
| `--color-status-applied-bg` / `-fg` | Applied tag pill |
| `--color-status-ignored-bg` / `-fg` | Ignored tag pill |
| `--color-tag-bg` / `-fg` | Reason tag pill (neutral, single tone) |
| `--color-danger-bg` / `-border` / `-fg` | alert box (kept visually distinct from the rest of the system) |
| `--radius-sm` | pills, inputs, buttons |
| `--radius-md` | table rows |
| `--radius-lg` | panels/cards |
| `--container-content` | page content max width (Tailwind v4's `--container-*` namespace generates `max-w-*`, so this becomes `max-w-content`) |

**Width token value:** current content width is `max-w-5xl` = 1024px (`src/app/page.tsx:54`). At a 1288px viewport with `px-6` (24px) side padding on `<main>`, usable space is 1240px, unused space beyond 1024px is 216px; half is 108px → **1132px**, which I'll round to **1120px** (`--container-content: 1120px`) as a clean value close to the ~1100px target.

**1120px is the content box width itself (the `max-width` applied to `<main>`), it does not include the side padding.** `px-6` (24px each side) still applies inside that box, same as today's `max-w-5xl px-6`. The token lives in `src/app/globals.css`, defined under `@theme inline` as `--container-content: 1120px`, which generates the `max-w-content` utility used on `<main>` in `src/app/page.tsx`.

Exact hex values aren't fixed in this plan — I'll pick them from the reference image (near-black page, slightly-lighter panel, lighter-still row, indigo/violet accent ~`#6366f1`–`#8b5cf6` range) when building, then verify contrast.

## Files to change

- `src/app/globals.css` — tokens (above), replaces current `--background`/`--foreground`.
- `src/app/page.tsx` — width, spacing, section containers, alert box, sync status text, wiring sort/dir through to children.
- `src/app/VacancyTable.tsx` — row/card styling, sortable `<th>` headers with links + `aria-sort`, View link restyle, status/reason pills.
- `src/app/VacancyTabs.tsx` — tab bar restyle, accent underline.
- `src/app/VacancyPagination.tsx` — centered "Showing X of Y" + "Read more"/"Show all" block as ghost pill buttons.
- `src/app/VacancyFilterBar.tsx` — input/select/button restyle, hidden `sort`/`dir` fields.
- `src/app/VacancyActions.tsx` — button system (filled accent vs ghost), focus rings.
- `src/app/SyncButton.tsx` — "Sync now" button restyle.
- `src/app/SyncDetails.tsx` — `<details>`/`<summary>` restyle (native semantics kept).
- `src/app/privacy/page.tsx` — same token system, dark surface.
- `src/app/error.tsx` — token sweep for consistency (small).
- `src/lib/vacancyActions/vacancyLinks.ts` — extend `VacancyHrefParams` with `sort`/`dir`, drop-on-tab-change logic in `buildVacancyHref`.
- `src/lib/vacancyActions/vacancyTabs.ts` — likely home for `VacancyTabSearchParams` additions (or keep in `getVacancyTabData.ts`, same file that already owns it).
- **New** `src/lib/vacancyActions/vacancySort.ts` — column definitions per tab, cycle logic, comparators, `sortRows`.
- `src/lib/vacancyActions/getVacancyTabData.ts` — resolve `sort`/`dir`, call `sortRows` after filtering, before `sliceRowsForShow`.
- Tests: new `vacancySort.test.ts`, updates to `vacancyLinks.test.ts`, `VacancyTable.test.tsx`, `VacancyTabs.test.tsx`, `VacancyPagination.test.tsx`, `VacancyFilterBar.test.tsx`, `getVacancyTabData.test.ts`.

## Per-component restyle list

- **Page shell** (`page.tsx`): `bg-surface-page`, content wrapped at `max-w-content`, centered. Heading in `text-primary`.
- **Sync status**: "Sync now" becomes the shared button system (filled-accent style, since it's the primary action here — matches "Applied" treatment). Status line in `text-secondary`. Alert box: `bg-danger-bg`/`border-danger-border`/`text-danger-fg`, kept visually distinct from the rest of the system (not reusing panel tokens).
- **Details / Recent syncs**: native `<details>`, panel surface, `text-secondary` summary, token-based list text.
- **Filter bar**: becomes a `surface-panel` strip, rounded (`radius-lg`), padded. Inputs/select/date use one shared input style (`surface-row` bg, `border-subtle`, `radius-sm`, focus ring in accent). "Search" button uses the shared button system (filled accent, it's a primary submit). "Clear filters" is a ghost pill link.
- **Tabs**: underline-style tab bar, active tab gets `border-accent` underline + `text-primary`, inactive `text-secondary`; counts always muted (`text-muted`), text content unchanged. Reason-filter row below (ignored tab) gets the same muted/accent active treatment, smaller scale.
- **Table**: real `<table>` kept. Rows styled as `surface-row` rounded cards (`radius-md`) with `hover:bg-surface-row-hover`, small vertical gap between rows (border-spacing or padding trick since `<table>` rows can't have `margin` — use `border-spacing-y` on the table with `border-collapse: separate`). Header row: `text-secondary`, `border-subtle` bottom rule, sortable columns are links with an arrow icon on the active column and `aria-sort` set.
  - **View**: becomes a ghost text link, `text-secondary` hover `text-accent`, small inline arrow-out SVG icon, same `href`/`target`/`rel`.
  - **Status** (All tab) / **Reason** (Ignored tab): small uppercase tinted pill, `radius-sm`, using the status/reason tokens.
  - **Actions**: buttons restyled per the shared system below.
  - Empty state text: `text-secondary`, "Clear filters" link becomes ghost pill.
- **Actions** (`VacancyActions.tsx`): single `CONTROL_CLASS`-equivalent split into two variants:
  - **Filled accent** (`Applied`): `bg-accent text-accent-foreground`, used only for "Applied".
  - **Ghost** (`Ignore`, `Ignore with reason`, `Undo`, `Edit date`, `Save`, `Cancel`): `border-subtle`, transparent bg, `hover:bg-surface-row-hover`, `text-secondary` → `text-primary` on hover. `Save` gets a real disabled style (`disabled:opacity-40 disabled:pointer-events-none`, already present — keep, re-tokenize).
  - "Ignore with reason" stays a native `<select>` styled to match ghost buttons, with a small chevron icon layered via CSS (background-image SVG or `appearance:none` + absolutely positioned icon) since native selects can't have arbitrary child markup.
  - Visible focus ring (`focus-visible:ring-2 ring-accent`) added to every interactive control across all restyled components.
- **Pagination**: "Showing X of Y" + "Read more"/"Show all (Y)" become one centered block (`text-center`) under the table; the link becomes a ghost pill button, same `href`.
- **Privacy page**: swap inline `style` max-width box for the token system — `surface-page` background, `text-primary`/`text-secondary`, same copy, same structure.
- **Error page**: token sweep only (`bg-surface-page`, `text-primary/secondary`, shared button).

## Sorting design

**New module `src/lib/vacancyActions/vacancySort.ts`:**

- `SortableColumnKey` — union of every sortable key across all tabs: `"title" | "company" | "location" | "firstSeenAt" | "appliedOn" | "ignoredOn" | "ignoreReason" | "status"`.
- `COLUMN_DEFS: Record<SortableColumnKey, { label: string; getValue: (row: VacancyTabRow) => string | null; compareValues?: (a: string, b: string) => number }>` — a `Record` over the full union, built with `satisfies`, so a missing `label`/`getValue` fails the build. `getValue` returns the raw sort value (`null` or `""` both count as empty); `compareValues` defaults to `localeCompare(..., undefined, { sensitivity: "base" })` when omitted, overridden for date columns with a plain string compare.
- `COLUMNS_BY_VIEW: Record<VacancyTabView, readonly SortableColumnKey[]>` — `todo`/`applied`/`ignored`/`all` each list their own sortable keys per the spec (todo/applied/ignored/all base: title, company, location, firstSeenAt; applied adds appliedOn; ignored adds ignoredOn, ignoreReason; all adds status). Link/Actions are never in this list.
- `resolveSort(view, sortParam, dirParam): { sort: SortableColumnKey | null; dir: "asc" | "desc" | null }` — invalid column, invalid dir, or a column not in `COLUMNS_BY_VIEW[view]` all resolve to `{ sort: null, dir: null }`.
- `nextSortState(column, currentSort, currentDir)` — cycle logic: not-current-column or `dir === null` → `asc`; `asc` → `desc`; `desc` → `{ sort: null, dir: null }`.
- `sortRows(rows, sort, dir): VacancyTabRow[]` — if `sort`/`dir` are null, returns `rows` unchanged (preserves today's order exactly, since `rows` arrives already in DB order: `first_seen_at desc, id desc`). Otherwise, for every pair: if both values are empty (`null`/`""`), tie-break by `id`; if exactly one is empty, the empty one sorts after the other **unconditionally** (i.e. this check happens before, and is not flipped by, the asc/desc sign) — this is what makes empty sort last in both directions; if neither is empty, compare via `compareValues`, multiplied by `+1`/`-1` for asc/desc, falling back to ascending `id` compare on a tie.
- Comparators — every sortable column uses the same `getValue`/empty-last machinery above, generalized across the board (not limited to columns that happen to render `"-"`):
  - Text columns (`title`, `company`, `location`): `getValue` returns the raw field (`row.location` can be `null`); default `localeCompare` with `sensitivity: "base"`, same pattern as `distinctCompaniesSorted` in `vacancyFilters.ts`. An empty/null `location` sorts last in both asc and desc.
  - Date columns (`firstSeenAt`, `appliedOn`, `ignoredOn`): `getValue` returns the raw ISO string (`null` for `appliedOn`/`ignoredOn` when absent, though in practice they're always present for rows on their own tab); `compareValues` is a plain string compare (ISO format sorts correctly lexicographically); `asc` = oldest first.
  - `ignoreReason`: `getValue` returns `REASON_LABELS[reason]` when set, `null` when not — `null` sorts last in both directions via the same generic empty-last rule (not a special case).
  - `status`: `getValue` returns `STATUS_LABELS[row.status]` (never empty); default locale compare.

**Wiring:**

- `VacancyTabSearchParams` (in `getVacancyTabData.ts`) gains `sort?: string | string[]; dir?: string | string[]`.
- `getVacancyTabData` calls `resolveSort(view, params.sort, params.dir)`, then `sortRows(filteredRows, sort, dir)` **after** `matchesVacancyFilters`/`selectRowsForView`/status-filter, **before** `sliceRowsForShow`. `counts` and `filteredCount` are computed from the pre-sort set, so they're unaffected (matches "Showing X of Y" and tab counts not changing).
- `VacancyTabData` gains `sort` and `dir` so `page.tsx` can pass them down.
- `VacancyHrefParams` (in `vacancyLinks.ts`) gains `sort?: string | null; dir?: "asc" | "desc" | null`. `buildVacancyHref` sets `sort`/`dir` query params only when `COLUMNS_BY_VIEW[params.view]` contains `params.sort` — this single check is what implements "drop sort/dir if the column isn't on the target tab" for every link type (tabs, pagination, header links) in one place, since they all call `buildVacancyHref` with the link's target `view`.
- **Tab links / pagination links**: already spread `VacancyHrefParams` — pass `sort`/`dir` through from `page.tsx`, no new logic needed beyond the `buildVacancyHref` change above.
- **Filter form** (`VacancyFilterBar`): add `<input type="hidden" name="sort">` / `name="dir">` (rendered only when set) so submitting keeps them; the form already omits `show`, so submitting still resets pagination as today.
- **Clear filters** links (`VacancyFilterBar`, `VacancyTable` empty state): currently `buildVacancyHref({ view, reasonFilter })` — add `sort`/`dir` so clearing filters keeps the current sort (per spec, "Clear filters" clears filters only).
- **Column headers** (`VacancyTable`): each sortable `<th>` wraps its label in a `<Link href={buildVacancyHref({ ...currentHrefParams, sort: column, dir: nextDir })}>` where `nextDir` comes from `nextSortState`. `aria-sort` on the `<th>` is `"ascending"`/`"descending"` when that column is the active sort, `"none"` otherwise (only set on sortable `th`s). An inline arrow SVG renders only on the active column, pointing per `dir`. `VacancyTable` needs the full `VacancyHrefParams` plus `rows`, `hasActiveFilters`, `clearFiltersHref` — it currently takes none of the href params, so this is a real prop-surface change.

## Tests to add

All pure-function tests (per repo convention — async server components can't render in tests); component tests use `@testing-library/react` with `afterEach(() => cleanup())` in jsdom per existing pattern.

- **`vacancySort.test.ts`** (new):
  - `nextSortState`: none→asc, asc→desc, desc→none, switching column resets to asc.
  - `resolveSort`: valid column+dir per view; invalid column name ignored; invalid dir value ignored; column valid on one tab but not another ignored (e.g. `status` on `todo`); missing params → `{ null, null }`.
  - Comparators, one test per column: asc, desc, tie broken by `id`, case-insensitivity (text columns), `ignoreReason` null sorting last in both asc and desc, **and `location` null/empty sorting last in both asc and desc** (the general empty-last rule, not a `"-"`-specific one).
  - `sortRows`: with `sort: null` returns input order unchanged (today's-order guarantee); with a sort, confirms full-row-set ordering (not just the visible slice) — i.e. sort happens before `sliceRowsForShow` is applied by the caller.
- **`vacancyLinks.test.ts`** (extend): `sort`/`dir` appear in the query string when set and valid for the target view; dropped when the target view doesn't support that column; dropped when not set.
- **`VacancyTable.test.tsx`** (extend): header link hrefs for first click (none→asc) and second click (asc→desc) on a given column; `aria-sort` reflects active column and direction; non-active sortable headers have `aria-sort="none"`; Link/Actions headers aren't links and have no `aria-sort`.
- **`VacancyTabs.test.tsx`** / **`VacancyPagination.test.tsx`** (extend): links carry `sort`/`dir` when present, drop them when the target tab doesn't support the column.
- **`VacancyFilterBar.test.tsx`** (extend): hidden `sort`/`dir` fields render with current values; "Clear filters" href keeps `sort`/`dir`.
- **`getVacancyTabData.test.ts`** (extend): invalid `sort`/`dir` params fall back to default order; valid sort changes `rows` order but not `counts`/`filteredCount`; sort is applied to the full filtered set before the `show` slice (e.g. sorting surfaces a row that wasn't in the first 10 by default order).

## Risks

- Tailwind v4's `@theme` token approach is new to this file (currently only 2 tokens) — if a token name collides with a Tailwind built-in utility name, builds can behave unexpectedly. Mitigate by namespacing clearly (`surface-*`, `status-*`, `tag-*`) and running `npm run build` before considering the work done.
- `VacancyTable` prop surface grows substantially (from 4 props to the full `VacancyHrefParams` set) — every existing `VacancyTable.test.tsx` render call needs updating, which is mechanical but touches every test in that file.
- Styling a native `<select>`'s chevron without JS/extra markup is CSS-only (`appearance: none` + background-image or a wrapper with pointer-events-none icon) — risk of inconsistent rendering across browsers; acceptable since this is desktop-only and the app is single-user.
- Row-gap on a real `<table>` (not flex/grid) requires `border-collapse: separate` + `border-spacing`, which also affects the header-to-first-row gap — needs a visual check once built.
- Contrast: muted/secondary text tokens on dark surfaces are the most likely to land under 4.5:1 — will be checked explicitly and reported.

## Out of scope

- Light mode / theme toggle.
- Responsive/mobile layout.
- New dependencies, fonts, env vars, Supabase/schema changes.
- Any UI wording changes beyond what's listed above.
- Sidebar, avatars, drag handles (reference image traits explicitly excluded).
- Multi-column sort (one `sort`/`dir` pair only, per spec).

## Preview-test checklist (for the owner)

- [ ] Native `<select>` (Company, Ignore reason, Status filter), date inputs (From/To), and scrollbars render dark (no light native chrome flashing through).
- [ ] Table titles like "Senior Executive (Digital Product Owner)" wrap less than before at the new width.
- [ ] Click each sortable header once (→ asc), twice (→ desc), three times (→ none) on every tab; confirm URL `sort`/`dir` params and row order.
- [ ] Switch tabs while a sort is active on a column that doesn't exist on the target tab (e.g. sort by "Status" then click "To do") — confirm `sort`/`dir` drop from the URL.
- [ ] Submit the filter form while a sort is active — confirm the sort survives and `show` resets to the default.
- [ ] Click "Clear filters" while a sort is active — confirm filters clear but sort stays.
- [ ] "Applied" button reads as the clear primary action; "Ignore"/"Ignore with reason" read as secondary.
- [ ] Tab through all interactive controls (filters, tabs, table actions, pagination) — focus ring visible at every stop.
- [ ] "Ignore with reason" dropdown opens, chevron renders, selecting a reason still fires the ignore action.
- [ ] Alert box (when present — e.g. force a stale sync) is visually distinct from the rest of the page.
- [ ] `/privacy` page matches the system.
- [ ] Resize browser to ~1288px wide and sanity-check the measured content width looks right (not a hard requirement since desktop-only/no responsive work, just a gut check on the token value).
