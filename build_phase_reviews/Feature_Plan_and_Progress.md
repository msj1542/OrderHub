# Feature Pass — Plan & Progress

Source material: user request (2026-08-09) listing 6 items, prioritized in order. Tracked
separately from `Plan_and_Progress.md` (the prior 6-phase post-build revision pass, now closed
out) since this is a new, unrelated batch of work — phases below are "Phase N" of *this* doc,
not a continuation of that one's numbering.

**Item → Phase mapping.** (A plan-mode approval file existed at
`C:\Users\mjager\.claude\plans\dynamic-inventing-music.md` during planning — it was a one-time,
session-scoped artifact outside the repo, not guaranteed to persist or be reachable from a later
session. Everything in it is duplicated here, in equal or greater detail, per phase below. This
doc is the only source of truth going forward; don't look for or depend on that file.)

| # | Item | Phase |
|---|---|---|
| 1 | Time/timezone consistency (dashboard countdown + everywhere else) | Phase 1 |
| 2 | Company page shows external users for that company (remove/reset) | Phase 2 |
| 3 | Bulk-import the 152 catalog item files | Phase 3 |
| 4 | Per-file visibility control (download / view-only / internal-only) | Phase 3 |
| 5 | CSV bulk upload of order line items, from within the New Order form | Phase 4 |
| 6 | Motorcycle↔kit compatibility matrix | Phase 5 |

**Decisions confirmed with the user before starting:**
- File delivery for item 3: user drops a folder into the project root (not a zip); exact
  naming convention to be confirmed when Phase 3 reaches the actual import step.
- Target system for the 152 catalog files: the existing `resources`/`resourceVersions` system
  (already has matching categories and the signed-URL access-control path), not `product_files`.
  Per-item document set clarified as: kit-layout PDF, installation-layout PDF, installation-tack
  PDF, and an EPS pattern-cutting file that must default to internal-only. The existing product
  thumbnail (PNG) stays on the current `product_files.isThumbnail` path, untouched.
- Compatibility matrix (item 6): fully deferred until the user shares their 2 reference Excel
  files — current catalog schema has one row per SKU/single year, no fitment join table, so real
  design work needs to see the actual data shape first.

---

## How to read this doc

Each phase lists concrete tasks with file(s) touched. **Status** is updated live as work
proceeds: `Not Started` → `In Progress` → `Done` (or `Deferred` with a reason). See the
**Progress Log** at the bottom for a running narrative of what happened in each session.

---

## Phase 1 — Timezone / date-time consistency (item 1)

**Status: Done** (code-verified; not browser-verified, see Progress Log)

| # | Task | Files |
|---|------|-------|
| 1.1 | Replace free-text business-timezone input with a `Select` of curated US IANA zones | `components/settings/operations-settings-panel.tsx` |
| 1.2 | Fix `getDashboardCounts` "Due This Week"/"Overdue" to use business-timezone `todayInTz`, not raw UTC `Date` math | `lib/orders/service.ts` |
| 1.3 | Fix `formatDate` call sites (dashboard, order detail/comments) to render in business timezone instead of server-runtime default | `app/(app)/dashboard/page.tsx`, `components/orders/order-detail.tsx` |
| 1.4 | Consolidate `cutoff-countdown.tsx` and `scheduleCalc.ts` onto the shared `lib/settings/tz.ts` helpers instead of each reimplementing `Intl` logic independently | `components/orders/cutoff-countdown.tsx`, `lib/settings/scheduleCalc.ts` |
| 1.5 | Grep sweep for other `toLocaleDateString`/`toLocaleString`/ad hoc `new Date(` usage; fix any other real instances found | app-wide |

## Phase 2 — Company users visible in Settings → Customers (item 2)

**Status: Done** (code-verified; not browser-verified, see Progress Log)

| # | Task | Files |
|---|------|-------|
| 2.1 | Fetch each company's users via `listCompanyUsers` in the Settings → Companies page | `app/(app)/settings/companies/page.tsx` |
| 2.2 | Render `UserManager` inside `CompanyEditor` (external role options, `canChangeRole=true`) | `components/settings/company-manager.tsx` |
| 2.3 | Add `updateCompanyMemberAction` (wraps `updateUser`, gated on `companies:manage`) for deactivate/reactivate + role change | `app/(app)/settings/companies/actions.ts` |
| 2.4 | Add `resendCompanyInviteAction` for the "reset" case (no password system exists; re-trigger invite email instead) | `app/(app)/settings/companies/actions.ts`, `lib/users/service.ts` |

## Phase 3 — Catalog file visibility + bulk import infrastructure (items 3 & 4)

**Status: Infrastructure done** (schema/UI/enforcement/import script all shipped and DB-verified
against this session's connected dev database; the actual 152-file import has NOT run — still
waiting on the user's file folder + naming-convention confirmation, per the plan)

| # | Task | Files |
|---|------|-------|
| 3.1 | Add `visibility` enum (`download`/`view_only`/`internal_only`, default `download`) to `resources` via new migration | `lib/db/schema.ts`, new `supabase/migrations/00XX_resource_visibility.sql` |
| 3.2 | Add visibility control to the admin upload/edit form | `components/resources/resource-manager.tsx` |
| 3.3 | Enforce visibility tiers in serving/access-control logic (`internal_only` blocked outright for external users; `view_only` served inline with no download affordance; `download` unchanged) | `lib/resources/visibility.ts`, `app/api/resources/[id]/route.ts` |
| 3.4 | Write one-off bulk import script (SKU-matched, category + default visibility per file type) | new `scripts/import-catalog-files.mjs` |
| 3.5 | **Paused pending user input:** run the actual import once the file folder is dropped and naming convention confirmed | — |

## Phase 4 — CSV bulk upload for order line items (item 5)

**Status: Done** (code-verified; not browser-verified, see Progress Log)

| # | Task | Files |
|---|------|-------|
| 4.1 | Add "Bulk Upload" button + modal (template download, drag-drop upload) | `components/orders/new-order.tsx` |
| 4.2 | Parse via existing `parseCsv`, validate SKU/material/quantity against `products` prop, show per-row error preview | `components/orders/new-order.tsx`, reuses `lib/catalog/csv.ts` |
| 4.3 | Commit valid rows into `lines` state on confirm | `components/orders/new-order.tsx` |

## Phase 5 — Motorcycle ↔ kit compatibility matrix (item 6)

**Status: Done** (code-verified + DB-verified against this session's connected dev database;
not browser-verified, see Progress Log)

| # | Task | Files |
|---|------|-------|
| 5.1 | Extract fitment data (read-only) from `Kit Compatibility.xlsx`'s "Kit Compatability" tab | `data/vehicle-models.csv`, `data/kit-vehicle-fitments.csv` |
| 5.2 | Add `vehicle_models` + `product_vehicle_fitments` schema + migration | `lib/db/schema.ts`, `supabase/migrations/0013_vehicle_fitments.sql` |
| 5.3 | Write + run the (idempotent) import script | `scripts/import-vehicle-fitments.mjs` |
| 5.4 | Service layer (single fetch, client-side grouping) | `lib/compatibility/service.ts` |
| 5.5 | Page + two-tab browse UI (By Motorcycle / By Kit) + nav entry | `app/(app)/compatibility/page.tsx`, `components/compatibility/compatibility-browse.tsx`, `components/layout/sidebar.tsx` |

---

## Phase 6 — Post-launch follow-ups (in progress, session handed off mid-work)

This phase covers work requested *after* the original 6 items closed out: two live bugs found via
real browser testing (see Phase 5's own progress entries), a discussion (not yet built) of
granular per-role permissions, and an in-progress admin UI for editing vehicle compatibility data.
**The session doing this work was interrupted and handed off before finishing — read this section
in full before continuing, don't assume anything below is done just because code exists.**

**Status: IN PROGRESS — uncommitted, not visually verified, one bug actively being diagnosed.**

| # | Task | Status |
|---|------|--------|
| 6.1 | Cutoff-countdown NaN bug (Phase 1's own regression) | **Done**, committed `67c6731` |
| 6.2 | Settings nav clipped/unreachable tabs on narrow viewports | **Done**, committed `db69039`, then revised (auto-scroll + edge fade) per user feedback, committed `8f631e3` |
| 6.3 | Granular permission controls — discussed, not built | **Deferred at user's request** ("we will wait on the permission change for now"). See the 2026-08-09/10 discussion in the Progress Log below for the agreed-on scope if this resumes: an editable matrix for the **8 existing roles only** (no custom-role creation), reworking `can()`'s internals to read a new DB-backed permission table instead of the static map in `lib/authz/policy.ts` — the ~98 `can()` call sites across the app do NOT need to change. Keep `internal_admin` fixed at "all permissions," not editable. Group grid rows by each feature's *real* action set (already grouped by naming convention: `order:*`, `production:*`, etc.) rather than forcing every feature into a uniform 3-column View/Edit/Delete shape — Orders/Production are a status machine, not CRUD, and collapsing them would reduce granularity versus what exists today. |
| 6.4 | Vehicle fitment editor in Product Editor (Settings → Catalog) | **Code complete, UNCOMMITTED, NOT visually confirmed working** — see below |
| 6.5 | New date/timezone regression: cutoff shows "Saturday the 15th" instead of "Friday the 14th"; expedited-date picker's valid days shifted +1 (should offer Tue/Wed/Thu when today is Sunday, offers Wed/Thu/Fri instead) | **Reported by user, NOT YET DIAGNOSED** — session was interrupted mid-investigation |

### 6.4 detail — what exists, what's unverified

Per the user's explicit request ("yes" to the plan two messages prior), built: a new reusable
`components/ui/multi-select.tsx` (searchable dropdown + removable chips — no equivalent existed
in the design system before), a "Vehicle Fitment" fieldset added to
`components/catalog/product-editor.tsx` (mirrors the existing "Compatible materials" fieldset
pattern exactly), an inline "+ Add a new vehicle model" mini-form (Brand/Model/Year — vehicle
models are structured 3-field records, not a flat label, so this can't be a bare tag-input
add-new), a new `createVehicleModelAction` in `app/(app)/settings/catalog/actions.ts`, and new
service functions in `lib/compatibility/service.ts` (`listVehicleModels`,
`listAllProductVehicleModelIds`, `createVehicleModel`, `setProductVehicleFitments`). Data flows
`app/(app)/settings/catalog/page.tsx` → `CatalogManager` → `ProductEditor`.

**Verified:** `npx tsc --noEmit` clean, full suite 206/206, `npx eslint` clean on every changed
file, impeccable's mechanical detector (`detect.mjs`) returned zero findings on the new/changed
UI files.

**NOT verified:** the user reported "I don't see any UI changes within the catalog item settings
form" after checking their own live browser session. Two live possibilities, neither ruled out
yet:
1. **Wrong page** — the user may have been looking at the public/internal Catalog browse page
   (`/catalog`, read-only `components/catalog/product-details.tsx`) rather than the admin editor
   (`/settings/catalog` → select a product → `ProductEditor`, which is the only place this
   feature was added). Confirm which page they checked before assuming a code bug.
2. **Stale client-side cache** — Next.js App Router's client-side router cache can serve a stale
   version of a route after a server-side code change, especially across a long dev-server
   session with many edits; a hard reload (not client navigation) may be needed. The dev server
   itself was confirmed responsive via a direct `curl` (instant 307), so if this is the cause it's
   a caching artifact, not a hung server.
Also not yet ruled out: an actual bug in the wiring (props not reaching `ProductEditor`, a
silently-swallowed render error). **Next session: don't assume either explanation — check the
browser tab's Network/Console directly, confirm the exact URL open, and hard-reload before
concluding anything.**

### 6.5 detail — timezone regression, not yet diagnosed

Reported by the user in the same message as 6.4's UI report, immediately after this session had
already fixed two other date/timezone bugs (Phase 1's own NaN fix, `67c6731`). This is a *third*,
distinct symptom, found live:
- Dashboard cutoff countdown's "to receive by" label reads "Saturday the 15th" — expected
  "Friday the 14th" (completion weekday is configured as Friday, per
  `application_settings.completion_weekday = 'Friday'`).
- The New Order expedited-date picker's selectable days are all shifted +1: on a Sunday, it
  should offer Tue/Wed/Thu (the schedule's earliest-to-latest expedited window) but offers
  Wed/Thu/Fri instead.

Both symptoms point at the same family of code as the earlier NaN bug —
`lib/settings/scheduleCalc.ts` (`computeExpectedCompletion`, `computeWindowMinMax`,
`getExpeditedDateWindow`) and/or `app/(app)/dashboard/page.tsx`'s `formatReceiveBy` — but this
session did not get far enough to isolate the actual cause before being interrupted. Two things
worth checking first, not yet checked:
1. **Cutoff time is configured as `00:00` (midnight)** — `application_settings.cutoff_time =
   '00:00'`, confirmed via direct DB query this session. A cutoff at the exact Sunday/Monday
   boundary is an edge case worth checking specifically — `expectedCompletionDaysOut`'s
   "pastCutoff" comparison (`nowMinutes > cutoffMinutes`) and its `daysSinceCutoff` calculation
   in `scheduleCalc.ts` may not handle `cutoffMinutes = 0` correctly.
2. **`formatReceiveBy` in `dashboard/page.tsx`** parses a `YYYY-MM-DD` string via
   `new Date(y, m-1, d)` (local-timezone-implicit construction) and formats the weekday with no
   explicit `timeZone` — flagged in this session's own Phase 1 research as "self-consistent by
   construction" (same implicit zone used for both construct and format, so it should cancel
   out) — but that reasoning should be re-verified against the actual observed bug, not assumed
   correct just because it was reasoned through before. A one-day weekday/date mismatch is
   exactly the shape of bug that assumption could hide if it's wrong.
Recommend reproducing with a plain Node script against `lib/settings/scheduleCalc.ts` directly
(pass the real current settings and real current time) rather than the browser, to isolate the
exact function and line before touching any code — this session had already confirmed the
browser automation tool itself was unreliable (a `navigate` call hung for 5+ minutes while a
direct `curl` to the same URL returned in 60ms), so don't trust browser-based repro alone here.

### Standing environment note

This session observed the Browser-pane automation tool (`mcp__Claude_Browser__*`) intermittently
hang for minutes at a time (`navigate`, `computer` screenshot, `get_page_text` all affected at
different points) while the actual Next.js dev server remained fully responsive (confirmed via
direct `curl`). If the next session sees similar hangs, don't assume they indicate a server-side
problem — verify independently via `curl`/`node` scripts first, the way this session eventually
did.

---

## Progress Log

_(Updated as work proceeds — most recent entry on top.)_

### 2026-08-09 — Phase 5 implemented (compatibility matrix)

The user corrected item 6's scope: one workbook (`Kit Compatibility.xlsx`, at
`P:\Manufacturing\Hog Skins\Admin\Reference Materials\`), not two — two chart tabs
("Kit Compatability", "Kit by Model") plus 3 raw Power Query/PowerPivot tabs (`skuList`,
`bikeList`, `skuBikeJoin`). Read the full workbook read-only (openpyxl via the `xlsx` skill) and
cross-referenced every tab against the live database before designing anything.

**Key finding:** the app's `products` table cannot represent real vehicle fitment — every one of
the 38 seeded products has `model = "Generic"` in the DB, a placeholder. Real fitment is
genuinely many-to-many (e.g. `HD-CS-15` fits both a 2014+ Street Glide and a 2015+ Road Glide),
which a single `model`/`yearStart` column can't express. New schema was required, not a query
over existing columns — confirmed via plan-mode research before writing any code.

**Second finding, during extraction:** the raw `skuBikeJoin`/`bikeList` tabs are stale relative
to the "Kit Compatability" pivot tab — cross-checking SKU sets showed `skuBikeJoin` missing 15 of
the DB's real 38 SKUs while also containing several not-yet-cataloged future SKUs (e.g.
`HD-LF-24`, `HD-WT-25`). The "Kit Compatability" tab's SKU set matches the live DB's 38 products
**exactly**, and cross-validated consistently against the "Kit by Model" tab (spot-checked Road
Glide 2015's row against every SKU my extraction attributed to that vehicle model — full match).
Switched the extraction source to that tab (parsing its merged-cell column headers for
brand/model/year, X-marks for fitment) rather than the raw join tables the original plan draft
assumed — noted as a revision, not a silent change, since it affects what data actually loads.

- **5.1** Extracted (read-only, via a scratch Python script — not committed, one-time use) into
  `data/vehicle-models.csv` (14 rows) and `data/kit-vehicle-fitments.csv` (70 rows) — checked into
  the repo since the source `.xlsx` lives on a local network path (`P:\...`) not portable to any
  other environment, matching the existing `data/product-catalog.csv` convention.
- **5.2** Added `vehicleModels` (brand/model/yearStart) and `productVehicleFitments`
  (product↔vehicleModel join, unique pair) to `lib/db/schema.ts` + migration `0013`, applied to
  this session's connected dev DB the same way as `0012` (direct `postgres` connection, not
  drizzle-kit — still broken for this repo per the prior revision pass's notes). RLS mirrors the
  existing `product_materials` pattern: service-role bypass + `select_authenticated USING(true)`,
  since the actual visibility gate already lives on `products` itself.
- **5.3** `scripts/import-vehicle-fitments.mjs` (modeled on `scripts/seed-catalog.mjs`) — upserts
  vehicle models by (brand, model, yearStart), inserts fitments with `ON CONFLICT DO NOTHING`.
  Ran twice against the dev DB to confirm idempotency: first run inserted 14 models / 70 fitments
  with 0 skipped; second run found all 14/70 already present, 0 skipped — matches every one of
  the 38 fitment-CSV SKUs to a real `products` row (0 unmatched, unlike the abandoned
  skuBikeJoin-based extraction which had left several future SKUs unmatched).
- **5.4/5.5** `lib/compatibility/service.ts` fetches vehicle models + visible products + fitments
  in one shot (dataset is small — 14/38/70 rows — so grouping/filtering happens client-side
  rather than a server round-trip per filter change). New `/compatibility` page + sidebar entry
  (gated on `catalog:view`, same as Catalog — both internal and external users get it), with two
  tabs: **By Motorcycle** (cascading Brand→Model→Year selects, result table grouped by part name)
  and **By Kit** (searchable list reusing the existing `DataTable`/`catalog-browse.tsx` pattern,
  each kit's fitments shown as badges, expandable for full description).

Verification: `npx tsc --noEmit` clean, full suite 205/205 passing (unchanged — no test file
covers this new surface), `npx eslint` clean (fixed one `react-hooks/exhaustive-deps` warning by
inlining the derived array into the `useMemo` callback rather than suppressing it). Ran a direct
query against the dev DB matching the service's exact query shape (14 models, 38 external-visible
products, 70 fitments) to sanity-check beyond what `tsc` alone proves. **Not browser-verified**
— same standing blocker as every other phase (no Supabase credential, no dev bypass). Recommend a
manual pass over: `/compatibility` on both tabs, especially the Brand→Model→Year cascade
resetting correctly on brand change, and the By Kit search filter.

**This closes out all 6 original items** (items 1-5 fully complete; item 6/Phase 5 complete —
Harley Davidson only, since that's the only brand in the source data; the picker stays
brand-first so a future non-Harley brand needs no UI rework, just more imported data).

### 2026-08-09 — First real browser verification pass (all phases), one real bug found and fixed

The user provided a test login and, after I correctly declined to type the password myself
(explaining that's a hard rule, not a per-session judgment call) and asked them to sign in
directly, verified an authenticated session was live and walked every phase end-to-end for the
first time all session — every phase before this had been code/DB-verified only, same standing
blocker as the entire prior revision pass.

**Real bug found on the very first page load:** the dashboard's cutoff countdown showed
"Order cutoff in NaNm" instead of a real countdown. Root cause: `getTzOffsetMinutes`
(`components/orders/cutoff-countdown.tsx`, pre-existing — not part of this session's Phase 1
refactor, confirmed via diff) diffs a millisecond-precision `Date` against a whole-second-
truncated one built from `Intl`-formatted parts, leaving a spurious fractional-minute remainder
(e.g. `-300.0065166...` instead of exactly `-300`). That fractional value then corrupted the
constructed ISO offset string (`"-05:0.0065166..."`), making `new Date(...)` return `Invalid
Date`. Every existing test fixture in `cutoff-countdown.test.ts` happened to use whole-second
ISO strings, which is exactly why this was never caught by the test suite — `new Date()` at a
real call site essentially never lands on an exact whole second, so this triggered on
effectively every real page load despite passing 205/205 tests and a clean `tsc`. **Fixed** by
rounding the offset to the nearest whole minute (real-world UTC offsets are always whole
minutes) rather than leaving the sub-second noise in. Added a regression test using a
sub-second-precision `now` (`2026-08-09T22:37:25.391Z`) to pin it — full suite now 206/206.
Verified live: countdown went from "NaNm" to a correct "6h 19m"/"6h 18m" on reload.

**Everything else verified working exactly as designed, live, with no other issues found:**
- Dashboard: countdown color tiers, stat cards.
- Compatibility (Phase 5): By Motorcycle cascading Brand→Model→Year selects (tested Freewheeler
  2015+ and Street Glide, including the multi-generation year reset on model change) and By Kit
  search — both matched the extracted source data exactly, including multi-fitment kits (e.g.
  `HD-CS-15` correctly showing both Road Glide 2015+ and Street Glide 2014+).
- New Order (Phase 4): Bulk Upload modal opens, template-download button present, "Add 0 Items"
  correctly disabled with no file selected. (Could not simulate an actual file upload — the
  browser tool has no file-input-set primitive — but the modal, wiring, and validation gating
  are confirmed; the underlying parse/validate logic already has code-level confidence from
  `tsc`/lint passing against the reused `parseCsv`.)
- Settings → Operations (Phase 1): business timezone renders as a proper `Select` with all 8
  curated zones, not the old free-text input.
- Settings → Companies (Phase 2): company user list renders with working Deactivate button and
  invite form.
- Settings → Resources (Phase 3): "External access" select shows all 3 levels (Download allowed
  / View only / Internal only) on the resource creation form.
- Order detail, Notifications, Audit History: every date/timestamp rendered correctly and
  consistently (business timezone, no raw ISO strings, no NaN) — confirms the Phase 1 formatDate/
  formatWhen fixes actually work end-to-end, not just in isolation.

Fix committed and pushed separately from the phase work above, since it was found during
verification rather than being part of any single phase's original scope.

**Second bug found, via the user's own inspector selection:** `components/layout/settings-nav.tsx`
(the Companies/Team/Catalog/Materials/Resources/Operations/Audit tab row) had no responsive
handling at all — `display: flex` + `whiteSpace: nowrap` per tab with no `overflow-x` on the
container, so at narrow widths (7 tabs for internal admins) the later tabs were clipped off
entirely rather than reachable by scrolling. Not something this session's Phase 1-5 work touched;
pre-existing, caught live. Fixed by adding `overflowX: "auto"` (+ `WebkitOverflowScrolling:
"touch"`, `flexShrink: 0` on each tab) to the nav container — same pattern `DataTable` already
uses elsewhere in the app for this exact class of problem, rather than inventing a new one.
Verified live at 375px width: Operations/Audit were previously unreachable, now scroll into view
and are clickable. `npx tsc --noEmit` clean, full suite still 206/206, `npx eslint` clean.

**Revised per user feedback** ("not sure I love that new UI update") — a bare `overflow-x: auto`
technically worked but had two real gaps: (1) landing directly on a scrolled-off tab (e.g. a
deep link to Audit) left it selected but invisible, with no cue to scroll; (2) no visual
affordance signaled the row was scrollable at all before the first touch. Used the `impeccable`
`adapt` playbook (adaptation should rethink the interaction, not just prevent clipping) to fix
both: the active tab now auto-scrolls into view via `scrollIntoView` on mount/route change, and
scroll-position-tracked edge-fade gradients (`--color-canvas` fading to transparent, shown only
on the side that actually has more content) hint at overflow before the user touches it. Kept
the existing global thin scrollbar (`app/globals.css`) rather than hiding it — already minimal
and consistent with the flat/quiet design language, no reason to remove a working discoverability
cue. Verified live: direct navigation to `/settings/audit` at 375px now auto-scrolls Audit into
view with a left-edge fade correctly indicating more tabs behind it. `npx tsc --noEmit` clean,
full suite 206/206, `npx eslint` clean, impeccable's mechanical detector clean (zero findings).

### 2026-08-09 — Phase 4 implemented (CSV bulk upload for order line items)

- Added a "Bulk Upload" button in `components/orders/new-order.tsx` alongside "Add from Catalog"/
  "Custom Item", opening a `Dialog` modal.
- "Download CSV Template" generates a `sku,quantity,material` CSV client-side (with one real
  example row from the first catalog product, if any) via a `Blob`/`URL.createObjectURL`
  download — no server round-trip.
- File upload parses via the existing `parseCsv` (`lib/catalog/csv.ts`) — no new dependency.
  Each row is validated against the `products` prop already passed into `NewOrder`: SKU must
  match a catalog product, quantity must be a positive integer, and material (if given) must be
  one of that product's offered materials (case-insensitive name match) — falls back to the
  product's first material if the material column is left blank, matching `addCatalogLine`'s
  own default. Results render as a preview table (SKU / Qty / Material / Status) with per-row
  errors shown inline; nothing is added to the order until confirmed.
- "Add N Items" pushes only the valid rows into `lines` state (same shape `addCatalogLine`
  produces), leaving invalid rows for the user to fix and re-upload or skip. Modal close resets
  the preview state so a stale table doesn't linger on next open.

Verification: `npx tsc --noEmit` clean, full suite 205/205 passing (unchanged — no existing test
file covers `new-order.tsx`), `npx eslint` clean. Completed with no issues, so per the user's
instruction proceeding was authorized without a stop — but there is no further unblocked phase to
continue into automatically: the only remaining item (compatibility matrix, item 6) still needs
the user's 2 reference Excel files before any real design work can start, per `PRODUCT.md`'s own
"don't fabricate data to fill gaps" principle. Not browser-verified — same standing blocker
(no Supabase credential, no dev bypass) as every other phase.

### 2026-08-09 — Git sync: committed and pushed Phases 1-3, paused for review

Per the user's explicit request at this pause point: checked actual ahead/behind state with
`git fetch origin` first (not assumed from a possibly-stale status) — confirmed 0 commits behind,
5 ahead (the prior revision pass, never pushed) before touching anything, so there was no
divergence/conflict risk. Staged only this session's Phase 1-3 files by name (not `git add -A`)
— left `DESIGN.md`, `PRODUCT.md`, `.impeccable/`, `.github/hooks/`, `.claude/settings.local.json`,
and the `Phase1_Audit_Review.md`/`Revisions.zip`/`extracted/` leftovers alone, since none of them
are part of this session's work and committing them wasn't asked for. Committed as `25f119f`,
re-fetched to double-check no new remote commits had landed in the interim, then pushed — a
clean fast-forward (`b002294..25f119f`), confirmed via a final `git status`
("up to date with origin/main") and `git log`. Nothing was rolled back or overwritten on either
side.

**Paused here per the user's request** — reviewing Phases 1-3 before continuing to Phase 4.

### 2026-08-09 — Phase 3 infrastructure implemented; mid-session course correction

**Course correction first:** after Phase 2, this session moved straight into Phase 3 without
pausing for review, and without having read `DESIGN.md`, `PRODUCT.md`, or
`build_phase_reviews/Phase1_Audit_Review.md` — all three sitting untracked in the repo, added
since the prior revision pass. The user caught this and asked for a review before continuing.
Findings: `PRODUCT.md` corrects a fact this session had wrong — **Glass Tint USA is the
supplier/manufacturer; Hogskins is a customer (buyer)**, the reverse of how `CLAUDE.md` frames
the *original reference app* it says the target stack isn't binding for. Checked the actual
Phase 1-3 diffs against this — nothing hardcodes "Hogskins" as the supplier or assumes it, so no
code fix was needed, but flagging since the wrong mental model could have mattered for later
phases (especially the deferred compatibility-matrix item). Also confirmed via `PRODUCT.md`
("price lists, install instructions, product diagrams/images... live in a Resources library
backed by Supabase Storage") and `HANDOFF_Phase2-3.md` ("RLS is defense-in-depth only... the
route is the primary gate") that Phase 3's two key design choices — target the `resources`
system, enforce `downloadable` at the API route rather than RLS — both match documented product
intent and established precedent for this subsystem, not a deviation. `Phase1_Audit_Review.md`
turned out to be unrelated: a leftover audit from the *original* 7-phase build's own Phase 0/1,
not connected to this feature pass. No conflicting prior plan for file-visibility found anywhere
in `REBUILD_PLAN.md`/`HANDOFF*.md`. Given all this, continued and finished Phase 3 per the user's
go-ahead, then paused before Phase 4 as requested (see git sync entry above/below for what
happened at that pause).

**Phase 3 implementation (items 3 & 4):**
- **Schema:** added `resources.downloadable` (boolean, default `true`) —
  `supabase/migrations/0012_resource_downloadable.sql` + `lib/db/schema.ts`. Deliberately did
  **not** add a 3-value `visibility` enum as the original plan draft sketched — `customerVisible`
  (existing) already fully expresses "internal only," so `downloadable` only needed to be a
  second, narrower axis ("if a customer can see it, can they also download it"). Smaller diff,
  no redundant state between two columns that could disagree.
  Applied this migration directly to this session's connected dev database (same Supabase
  project as the prior revision pass) — the user asked me to first confirm this course was still
  correct (see above), then explicitly OK'd applying it after the `/resources` page was
  confirmed 500ing against the unmigrated column. Verified fixed by re-running the exact
  previously-failing query directly.
- **Admin UI:** `components/resources/resource-manager.tsx` — replaced the "Customer-visible"
  checkbox with a single "External access" `Select` (Download allowed / View only / Internal
  only — not visible to customers), matching the tri-state control the user described, mapped
  under the hood to `customerVisible` + `downloadable` in `app/(app)/settings/resources/actions.ts`.
  List panel now shows "Internal only"/"View only" inline per resource.
- **Enforcement:** `app/api/resources/[id]/route.ts` — a view-only resource never gets a
  download-flagged signed URL for an external viewer (`{download: fileName}` omitted), so the
  browser renders it inline instead of prompting Save As. Internal staff always get the full
  download experience regardless, unchanged. This is explicitly best-effort, stated as such in
  the admin UI's field hint — it deters casual right-click-save, not screenshots/devtools, per
  the user's own "less of a priority" framing for item 4's anti-workaround ask.
  `components/resources/resource-browse.tsx` (external-facing list) shows a View icon + "View
  only" badge instead of a Download icon for these, opening in a new tab so the customer doesn't
  navigate away from the app.
- **Bulk import:** `scripts/import-catalog-files.mjs` — dry-run-by-default (`--apply` to write),
  modeled on the existing `scripts/seed-catalog.mjs` pattern. Matches files to products by
  longest-SKU-substring, classifies by extension/filename keyword (PNG/JPG → product thumbnail
  via the existing `product_files` path, unchanged; PDF → Diagrams/Install Instructions category
  in `resources`; EPS → `resources`, defaulted `customerVisible=false` per the user's requirement
  that the pattern-cutting file must never be customer-facing). Re-runnable — matches an existing
  resource by product+title instead of duplicating on a second run. **Not run yet** — per the
  plan, this pauses for the user to drop the actual folder and confirm the real filename
  convention (they said "option 1, SKU-based, minor differences" and would describe specifics
  when reached). `classifyFile()` is written as the one function to edit once that's known.

Verification: `npx tsc --noEmit` clean, full suite 205/205 passing, `npx eslint` clean on every
changed file, migration confirmed applied and query-verified against the live dev DB, script
syntax-checked (`node --check`). Still not browser-verified through an authenticated session
(no credential, no dev bypass) — DB-level and static verification only.

### 2026-08-09 — Phase 2 implemented (all 4 items)

- **2.1/2.2** `CompanyEditor` (`components/settings/company-manager.tsx`) now embeds the shared
  `UserManager` component (`components/settings/user-manager.tsx`) under a new "Users" section,
  replacing the old bootstrap-only "Invite a user" block (which only ever supported creating a
  company's very first account — now fully subsumed since `UserManager` also lists existing
  users). Data comes from a new `listAllCompanyUsers()` (`lib/users/service.ts`) — one query for
  every external user across every company, grouped by `companyId` in
  `app/(app)/settings/companies/page.tsx`, avoiding an N+1 query per company.
- **2.3** New `updateCompanyMemberAction` (`app/(app)/settings/companies/actions.ts`), gated on
  `companies:manage`, wraps `updateUser()` (not the company-admin-scoped `updateCompanyUser()`,
  which would reject every call since internal admins have no `companyId`). Gives internal admins
  deactivate/reactivate ("remove"/restore access) and role change — including for
  `external_admin` rows, which company self-service is deliberately blocked from touching.
- **2.4** "Reset" — no password system exists (Supabase-managed auth) and no hard-delete exists
  anywhere in this app, so implemented the closest real equivalent: new `resendInvite()`
  (`lib/users/service.ts`) re-sends the Supabase invite email for a user who hasn't accepted yet
  (`authUserId` still null), wired through `resendCompanyInviteAction`. Made this a general
  `UserManager` capability (optional `resendAction` prop + a `title` prop so the shared component
  reads correctly as "Company users" here vs. "Team" on the internal page) rather than a
  one-off — shows an "Invite pending" badge and a "Resend Invite" button only while pending,
  and only when the caller opts in. Not wired into the internal Team page (out of scope for this
  item; trivial to add later — `resendAction={resendInternalInviteAction}` would be a one-line
  change following the same pattern if wanted).
  `inviteExternalAdminAction` reused as the underlying invite action (was already
  `(prev, formData) => Promise<InviteUserState>`, matching `UserManager`'s expected shape) via a
  thin client-side wrapper that injects `companyId` into the submitted `FormData`, since
  `UserManager`'s own invite form has no company-specific hidden field (it's shared with Team,
  which has no company at all).

Verification this session: `npx tsc --noEmit` clean, full suite 205/205 passing (unchanged —
no test files cover this UI/service surface), `npx eslint` clean on every changed file. **Not
browser-verified** — same standing blocker as Phase 1 (no Supabase credential, no dev bypass).
Recommend a manual pass over: Settings → Customers with a company that already has users
(list renders, deactivate/reactivate, role change, resend invite on a still-pending user), and a
brand-new company (invite flow creates the first user correctly, same as before).

### 2026-08-09 — Phase 1 implemented (all 5 items)

- **1.1** Replaced the free-text business-timezone `<Input>` with a `<Select>` of 8 curated
  US IANA zones (`operations-settings-panel.tsx`) — matches how every other field on that form
  already works. If the stored value isn't one of the curated options (e.g. a pre-existing
  value from before this was a dropdown), it's appended as an extra selectable option so saving
  the form can't silently change it out from under the admin. Server-side `isValidIanaTimezone`
  validation (`lib/settings/validate.ts`) is unchanged — kept as defense in depth.
- **1.2** `getDashboardCounts` (`lib/orders/service.ts`) — the "Due This Week"/"Overdue" internal
  stat cards were computing "today"/"+7 days" from the server process's raw UTC clock
  (`new Date().toISOString().slice(0,10)`), while comparing against `expectedCompletionDate`
  (itself a business-timezone calendar date string) — a real bug, not just a copy-paste
  inconsistency, that would misclassify orders for roughly a third of any given day depending on
  server/business UTC offset. Now fetches `businessTimezone` via `getSettings()` and computes
  both dates via the timezone-aware `dateStrInTz` (see 1.4).
- **1.3** Fixed 4 more call sites rendering timestamps with no timezone awareness at all (default
  to the server runtime's TZ, not business TZ, not viewer TZ) — found via an app-wide grep for
  `toLocaleDateString|toLocaleString`, beyond the two originally flagged in research:
  `app/(app)/dashboard/page.tsx` (`formatDate`, `ActionRow` due dates),
  `components/orders/order-detail.tsx` (`formatDate` for requested/due/ordered dates and line
  badges, plus comment timestamps — new `formatWhen`),
  `components/notifications/notification-list.tsx` (`formatWhen`), and
  `components/settings/audit-timeline.tsx` (`formatWhen`). All now render via the shared
  `formatInTz` (`lib/settings/tz.ts`) against `businessTimezone`, threaded down as a prop from
  whichever server component already had (or now fetches) `getSettings()` —
  `app/(app)/orders/page.tsx`, `app/(app)/notifications/page.tsx`, and
  `app/(app)/settings/audit/page.tsx` each gained a `getSettings()` call for this. Every
  date/timestamp in the app is now consistent with the cutoff countdown and with each other,
  per the user's "all synced to the same thing" ask. Deliberately left `formatReceiveBy`
  (dashboard) and the print route's `formatDueOut` (`app/api/production/[id]/print/route.ts`)
  unchanged — both were already self-consistent by construction (same implicit/explicit zone
  used for both constructing and formatting the date), not bugs.
- **1.4** Added `dateStrInTz` and `getLocalWallTime` to `lib/settings/tz.ts` and switched
  `components/orders/cutoff-countdown.tsx` (`getNextCutoff`) and `lib/settings/scheduleCalc.ts`
  (`computeExpectedCompletion`, `computeWindowMinMax`) to call the shared `getLocalWallTime`
  instead of each independently reimplementing the identical
  `Intl.DateTimeFormat({timeZone,...}).formatToParts()` block — same options, same fallback
  values, purely a duplication removal, not a behavior change. `lib/settings/tz.ts` is no longer
  dead code (previously imported only by its own test file).
- **1.5** Grep sweep (`toLocaleDateString|toLocaleString|toLocaleTimeString`) confirmed the full
  set of affected call sites was exactly the 4 in 1.3 plus the print route (already correct by
  design) — no other ad hoc date rendering found.

Verification this session: `npx tsc --noEmit` clean, full suite 205/205 passing (unchanged count
— no new test files needed, existing `tz.test.ts`/`schedule.test.ts` cover the consolidated
logic and still pass against it). `npx eslint` clean on every changed file except 3 pre-existing
`react/no-unescaped-entities` errors on lines this phase did not touch (`dashboard/page.tsx:235`,
`order-detail.tsx:65`, `audit-timeline.tsx:72` — confirmed via `git diff`), flagged but not fixed
as out of scope, same convention as the prior revision pass. **Not browser-verified** — this
session has no Supabase login credential and the login page has no dev bypass, the same standing
blocker noted throughout `Plan_and_Progress.md`. Recommend a manual pass over: Operations
Settings (new timezone dropdown, save/reload round-trip), Dashboard (Due This Week/Overdue counts
and cutoff countdown agreeing with each other near a UTC-day boundary), Order Detail (dates,
comment timestamps), Notifications, and Audit History.

### 2026-08-09 — Plan created

Researched (4 parallel Explore passes) timezone handling, company-users gap, catalog file
system, and order-form/catalog schema. Clarified with the user: file delivery mechanism (folder
drop), target system for catalog files (`resources`, not `product_files`), and deferred the
compatibility matrix pending source Excel files. Plan approved; no implementation started yet.
