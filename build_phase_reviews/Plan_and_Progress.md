# Post-Build Revisions — Plan & Progress

Source material: `build_phase_reviews/Revisions.zip` → `revision_instructions..md`,
`rushFeeCalculation.md`, and 29 annotated screenshots (`screenshot_269.jpg`–`screenshot_298.jpg`,
extracted to `build_phase_reviews/extracted/`). Yellow annotations = internal portal
(internal admin/coordinator), orange annotations = external portal (customer/company admin).

This plan covers the app's initial 7-phase build (already complete per
`Phase1_Completion.md`–`Phase7_Completion.md`) undergoing a **revision pass** based on the
user's hands-on review of that build. It is tracked separately from the original phase docs to
avoid numbering confusion — phases below are "Revision Phase N," not a continuation of the
original build phases.

**Decisions confirmed with the user before starting:**
- **Expedited orders become all-or-nothing per order** (the per-line-item "Expedited" checkbox
  in New Order is removed). Reasoning: splitting one order into rush/non-rush sub-groups implies
  splitting it into two invoices released at two different times anyway — which is no simpler
  than the customer placing two separate orders (one rushed, one normal). This also removes the
  need for a "mark rush items complete separately" production workflow (screenshot 285) — that
  workflow doesn't need to exist once expedited is order-level only. **This is a deliberate
  functional deviation from a strict port of any prior reference behavior**, explicitly approved
  by the user (see `CLAUDE.md` rule 4 — flagging inferences/deviations).
- No phase-priority preference given — phases below are sequenced by technical dependency
  (rush-fee/expedited data model first since other phases build UI on top of it; responsive
  overhaul last since it should apply to the final settled layouts, not layouts that are about
  to change again).

**Context note:** the working tree already contains uncommitted changes from the phase-7 build
that introduced the current (buggy) tiered rush fee mode, per-item expedited toggle, print
label/work-order formatting, invoice-verify modal, and operations settings panel — i.e. this is
the exact code the screenshots were taken against. This plan revises that existing
implementation; it does not start from scratch.

---

## How to read this doc

Each phase lists concrete tasks with the screenshot(s) and file(s) they come from. **Status**
is updated live as work proceeds: `Not Started` → `In Progress` → `Done` (or `Deferred` with a
reason). See the **Progress Log** at the bottom for a running narrative of what happened in each
session.

---

## Revision Phase 1 — Expedited Order Model & Rush Fee Calculation

**Goal:** fix the core business-logic bug (incorrect tiered rush fee %, incorrect cutoff
enforcement) and simplify the data model to order-level-only expedited, per the user's decision
above. This underpins Phases 2–4, so it goes first.

**Status: Done** (see Progress Log below — one item, 1.4, is code-verified but not
browser-screenshotted due to a dev-server port conflict this session; see note).

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 1.1 | Remove per-line-item "Expedited" checkbox/state from New Order; expedited becomes a single order-level toggle + one requested date that applies to every line. Rush fee prices the full order subtotal, not a filtered "expedited lines" subtotal. | screenshots 270, 271; user decision above | `components/orders/new-order.tsx`, `app/(app)/orders/new/actions.ts` |
| 1.2 | Fix tiered rush-fee calculation: percentages must be derived **once from the configured schedule** (shortest possible lead time = 1 business day → Max%, longest possible lead time = 7 business days → Min%, evenly interpolated across the days in between), not dynamically from "today." See `rushFeeCalculation.md` for the exact worked table and 3 scenario walk-throughs. | `rushFeeCalculation.md`; screenshots 296, 297 | `lib/settings/scheduleCalc.ts` (`computeTieredRushFeePercent`, `getExpeditedDateWindow`) |
| 1.3 | Fix cutoff-time enforcement on the expedited date picker: currently `getExpeditedDateWindow` always allows "tomorrow" as the earliest date regardless of cutoff day/time, and allows the current week's completion day (Friday) even when the cutoff for that week has already passed. Must match the 3 scenarios in `rushFeeCalculation.md` (Friday 1:30pm → Tue/Wed/Thu only; Monday 1:30pm → Wed through following Thu; Wednesday 4:45pm → Fri through following Thu). | `rushFeeCalculation.md`; screenshots 294, 296, 297 | `lib/settings/scheduleCalc.ts` |
| 1.4 | Fix the submit-confirmation alert/modal rendering bug on New Order (error/rush-fee-confirmation alerts render incorrectly). | screenshot 271 | `components/orders/new-order.tsx` |
| 1.5 | Fix New Order expedited-checkbox row alignment (checking "Expedited" on a line currently forces extra wrapping text above the input, breaking alignment); remove the redundant per-line helper sentence since the row layout is self-explanatory — **superseded by 1.1** (per-line checkbox is being removed entirely, so this alignment bug goes away with it; confirm no residual per-line UI remains). | screenshot 272 | `components/orders/new-order.tsx` |
| 1.6 | Operations Settings: add a toggle to disambiguate "same week" vs "following week" for the completion weekday relative to the cutoff weekday (needed because e.g. cutoff=Monday/completion=Tuesday is ambiguous between a 1-day and an 8-day turnaround). | screenshot 298 | `components/settings/operations-settings-panel.tsx`, `lib/settings/scheduleCalc.ts`, `lib/settings/service.ts`, settings schema/migration |
| 1.7 | Operations Settings: when Rush Fee Mode = Tiered, show a read-only table of the locked-in rush-fee % for every possible lead-time day (1..N business days), recalculated whenever cutoff/completion/max%/min% are saved. | screenshot 298 | `components/settings/operations-settings-panel.tsx` |
| 1.8 | Operations Settings: time-picker fields (cutoff time, completion time) should open the time-selection UI when clicking anywhere in the field, not just the clock icon. | screenshot 298 | `components/settings/operations-settings-panel.tsx` |
| 1.9 | Update `lib/settings/schedule.test.ts` / add new tests covering the corrected tiered-fee table and the 3 cutoff scenarios from `rushFeeCalculation.md`. | — | `lib/settings/schedule.test.ts` |

---

## Revision Phase 2 — Order Detail, Actions & Invoice Verification

**Goal:** fix role/status-aware button visibility, information hierarchy, and wording on the
order detail page (internal + external), and simplify the invoice verification workflow.

**Status: Done** (see Progress Log — not browser-verified this session; see note).

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 2.1 | External order detail: hide "Request Cancellation" and "Reorder" while status is `Submitted` (not yet accepted) — not actionable/relevant to the customer at that stage. | screenshot 269 | `components/orders/order-actions.tsx` |
| 2.2 | Internal order detail: remove "Request Cancellation," "Reorder," and "Add Supplemental Order" from the top action bar once an order is claimed/in production — they clutter a view where they're not the primary action; "Reorder" should only reappear once the order is completed/ready for pickup. Rename "Add Supplemental Order" → "Add to Order" (or similar) and gate it away once the coordinator has verified the invoice and marked the order ready for pickup. | screenshots 276, 279 | `components/orders/order-actions.tsx` |
| 2.3 | Relocate the "Claim" button out of the top action bar and into the Production section, next to Print Work Order / Print Labels, to match the production-queue table's layout. | screenshot 276 | `components/orders/order-detail.tsx`, `components/orders/order-actions.tsx` |
| 2.4 | Make the requested/expedited date section more prominent on an open order: move the Expedited/Submitted badges out of the top-right corner and into a highlighted callout around the date block (badges stay useful in table rows for quick scanning, per 2.9). | screenshot 269 | `components/orders/order-detail.tsx` |
| 2.5 | Reorganize the order detail header (both internal and external): group PO Number and Invoice Number together; swap the position of the order-number/company/customer-name block with the action-button row; hide "Not guaranteed until accepted" and the "Requested" label once the order is accepted; reduce prominence of the Ordered date (least important of the 3 dates) and increase prominence of the Expedited date (most important) relative to the standard due date. Apply the internal-view changes to the external view too, minus anything not customer-relevant, and make the invoice number/link more prominent on the external view specifically (to encourage the customer to click through). | screenshots 289, 290 | `components/orders/order-detail.tsx` |
| 2.6 | Rename "Expected Completion Date" everywhere in the app to clearer wording (e.g. "Default Due Date" / "Date of Completion") — current wording implies a guarantee it isn't. | screenshot 274 | grep all usages: `components/orders/*.tsx`, `app/api/production/[id]/print/route.ts`, dashboard/production copy |
| 2.7 | Accept Order modal: allow the accepting internal user to override/adjust the requested expedited date if it can't be met as requested (currently only editable for the non-expedited "Expected Completion Date" field). | screenshot 274 | `components/orders/order-actions.tsx` |
| 2.8 | Fix order-level vs. production-level status wording/consistency: the Production section's status ("Completed") must not get silently overwritten once the order-level status advances to "Ready for Pickup" — they track different things and should stay independently accurate. Reuse the "Awaiting Pickup" wording/coloring style (liked by the user) for the order-level "Ready for Pickup" status, while allowed to differ in exact color/wording between internal and external if useful. | screenshot 289 | `components/orders/order-detail.tsx`, `lib/orders/service.ts` |
| 2.9 | Fix/standardize the "Expedited" badge styling across all table rows (orders list, production queue) so it reads as bold, all-caps, color-consistent text in a fixed position rather than a misaligned badge — see rough mockups in screenshots 278/279. | screenshots 277, 278, 279 | `components/orders/orders-workspace.tsx`, `components/production/production-queue.tsx` |
| 2.10 | External order detail (Ready for Pickup): remove the redundant "Your order is complete and ready for pickup" banner (duplicates the badge). | screenshot 290 | `components/orders/order-detail.tsx` |
| 2.11 | Invoice Verification modal: replace the manual "Actual Invoice Total" entry field with a read-only, larger/bold "Expected Invoice Total" (the existing grand total) and let the attestation checkbox / discrepancy-reason field carry the confirmation, instead of asking the user to retype the total. | screenshot 288 | `components/orders/invoice-verify-modal.tsx` |
| 2.12 | Orders list badge: don't increment/show the "new order" notification badge for the order the current user just placed themselves. | screenshot 272 | `components/notifications/*`, wherever the Orders nav badge count is computed |

---

## Revision Phase 3 — Dashboard & Navigation Polish

**Goal:** clean up redundant dashboard information and make time-sensitive/action-needed states
more visually obvious, for both internal and external dashboards.

**Status: Done** (see Progress Log — not browser-verified this session; see note).

**Correction to this table (found during implementation):** 3.1/3.2/3.3 are labeled
"Internal dashboard" below, but screenshot 275 (their actual source) is the **external**
customer dashboard — sidebar shows Team/Notifications with no Production/Settings, and the
user is "Michael Jager · Company Admin · Test Company," and the stat cards named
("Drafts"/"Active Orders"/"Accepted"/"Ready for Pickup") only exist in the external branch of
the dashboard code. This looks like a copy-paste label slip from the prior session, not a
deliberate decision. Implemented against the external dashboard per the screenshot, per
CLAUDE.md rule 4 (flag inferences rather than silently guessing). 3.4/3.5 (screenshot 273/287,
"Internal Admin" sidebar, internal-only stat card set) and 3.6/3.7 (screenshot 284/291,
explicitly "External dashboard") were labeled correctly.

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 3.1 | **External** dashboard: make "Place New Order" ~10–20% larger and move it above the stat cards (it's the primary action). | screenshot 275 | `app/(app)/dashboard/page.tsx` |
| 3.2 | **External** dashboard: reduce redundancy between "Active Orders" / "Accepted" cards — the customer mainly needs to know "in production queue" vs. "ready for pickup"; detailed breakdowns stay available on the Orders list, not duplicated on the dashboard. | screenshot 275 | `app/(app)/dashboard/page.tsx` |
| 3.3 | **External** dashboard: move the "Order deadline Xd Yh" indicator from the top-right corner to sit directly right of "Place New Order," with more prominent styling (color escalation: default → yellow inside 24h → red inside 3h) and clearer copy ("Order cutoff is [x] to receive by Friday the [x]th," or similar). | screenshot 275 | `app/(app)/dashboard/page.tsx` |
| 3.4 | Internal dashboard: the Expedited tag is sometimes not populated/shown in the Priority Queue row for an order that is in fact expedited — investigate and fix. | screenshot 273 | `app/(app)/dashboard/page.tsx` |
| 3.5 | Internal dashboard: give the "invoice verification required" priority-queue item a more obvious callout for the responsible coordinator, beyond just the Orders nav badge increment. | screenshot 287 | `app/(app)/dashboard/page.tsx` |
| 3.6 | External dashboard: add a status callout showing kits are actively "in production" (exact wording TBD — "in progress" / "in production queue" / "being produced"), currently missing between order acceptance and completion. | screenshot 284 | `app/(app)/dashboard/page.tsx` |
| 3.7 | External dashboard: make "Ready for Pickup" stat card visually pronounced (e.g. green) so it stands out; add/update an Orders nav-bar badge on the customer-facing side when an order becomes ready for pickup. | screenshot 291 | `app/(app)/dashboard/page.tsx`, nav badge logic |
| 3.8 | Orders list and Production Queue: default the status filter to "Active" (open orders / current work) instead of "All," so closed/archived orders don't clutter the default view. | screenshots 277, 278 | `components/orders/orders-workspace.tsx`, `components/production/production-queue.tsx` |

---

## Revision Phase 4 — Production Queue, Work Orders & Label Printing

**Goal:** fix piece-tally sync bugs, tighten wording, and fix label/work-order print output.

**Status: Done** (see Progress Log — not browser-verified this session; see note).

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 4.1 | Fix piece-completion tally boxes: selecting box "2" before "1" currently doesn't behave correctly, and the per-line "X/Y done" counters don't stay in sync with the header's overall "X/Y pieces" count (most visible after "Finalize Incomplete Order"). | screenshots 285, 286 | `components/production/production-queue.tsx` |
| 4.2 | Rename "Record Non-Billable Re-cut" → "Record re-cut" to save space. | screenshot 285 | `components/production/production-queue.tsx` |
| 4.3 | Confirm no residual UI/logic remains for "mark rush parts complete separately" from "Finalize Incomplete Order" — not needed now that expedited is order-level only (Phase 1 decision); "Finalize Incomplete Order" stays a single whole-order action. | screenshot 285 (superseded) | `components/production/production-queue.tsx` |
| 4.4 | Decide and implement whether per-piece tally checkboxes should persist/reset once an order moves past "in production" (completed) — currently inconsistent; simplest fix is to stop rendering them post-completion and rely solely on the "X of Y pieces completed" summary. | screenshot 286 | `components/production/production-queue.tsx` |
| 4.5 | Print Labels modal: consolidate the duplicate per-item listing into a single row per SKU (remove the redundant second column); make per-row quantity editable when a row is toggled. | screenshot 280 | `components/production/*` (print labels modal), `app/api/production/[id]/print/route.ts` |
| 4.6 | Fix label print output to actually render in a grid layout on the printed page (currently prints 1 label per sheet despite the on-screen preview showing a grid). | screenshot 281 | `app/api/production/[id]/print/route.ts` |
| 4.7 | Remove the "RUSH" callout from customer-facing printed labels (internal-only detail); increase size of the part number/description text under the QR code for visual balance. | screenshot 282 | `app/api/production/[id]/print/route.ts` |
| 4.8 | Work order print layout: consolidate material-usage tables so there is exactly one header per roll/film type (e.g. one "Gloss PPF · 18\" roll" section listing every SKU that uses that roll, with total kits and total linear feet for that film), each row showing per-piece linear ft, quantity, expedited status, and inline tally boxes (reference the in-app production queue's layout for the row style). | screenshot 283 | `app/api/production/[id]/print/route.ts` |
| 4.9 | Work order print header: enlarge and reposition the expedited due-out callout (near the top, above/below the header) with explicit wording like "Expedited · Due Out: TUESDAY, AUG. 11." | screenshot 283 | `app/api/production/[id]/print/route.ts` |
| 4.10 | Production Queue row: fix the expedited-badge styling per 2.9, and make the due-date/piece-count info in the row more visible (not off to the side). | screenshot 277 | `components/production/production-queue.tsx` |

---

## Revision Phase 5 — Company/Team Settings (External) & Materials UI

**Goal:** give external company admins a proper Settings area (mirroring the internal one), and
address the flagged-but-unspecified Materials editor usability issue.

**Status: Done** (see Progress Log — not browser-verified this session; a DB migration is
generated but NOT applied, see note).

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 5.1 | Create an external-facing "Settings" section (nav item, alongside Dashboard/Orders/Catalog/Resources) that houses what is currently the standalone "Team" page, matching how internal users have Team under internal Settings. | screenshot 292 | new `app/(app)/settings/...` external route (or restructure `app/(app)/company-users/`), nav config |
| 5.2 | Add a Company Details section to the new external Settings (address, phone, email, and other standard company fields), self-serve editable by the company admin, syncing to what the internal Settings → Companies view shows for that company. | screenshot 292 | `components/settings/company-manager.tsx`, `app/(app)/settings/companies/actions.ts`, new external settings page |
| 5.3 | Redesign the Materials → roll-size editor (Settings → Materials) for clarity — current inline-table-of-inputs layout is flagged as hard to follow. No specific redesign was prescribed; propose a layout (e.g. one roll-size "card" per row with clearer labels/grouping) before implementing. | screenshot 293 | `components/catalog/material-settings.tsx` |

---

## Revision Phase 6 — Responsive / Mobile Overhaul

**Goal:** make the entire app usable on narrow viewports. This is a blanket requirement (not
screenshotted individually) and is sequenced last so it's applied to the settled post-revision
layouts rather than layouts that are about to change again in Phases 1–5.

**Status: Done** — all 5 items addressed. See Progress Log for a significant caveat on 6.5:
this is the first phase where a real authenticated browser session was available (previous
phases were blocked entirely), but the session's Browser pane reports it is not compositing
frames, which made pixel-level visual confirmation of animated/transform-based UI (the sidebar
drawer specifically) unobtainable even with login access — verified via DOM/inline-style/
`matchMedia` state instead, which was consistent and correct across every test. Read the full
note below before trusting 6.1's drawer animation without a manual check.

| # | Task | Source | Files (expected) |
|---|------|--------|-------------------|
| 6.1 | Sidebar must collapse (to an icon rail or a slide-out drawer behind a hamburger toggle) below a defined breakpoint instead of staying fixed-width and eating into content space. | revision_instructions..md | `components/layout/*` |
| 6.2 | All data tables (Orders, Production Queue, Catalog, Audit, etc.) must degrade gracefully on narrow widths — e.g. horizontal scroll containment, column priority/hiding, or a stacked-card view — instead of overflowing or shrinking into illegible columns. | revision_instructions..md | `components/orders/orders-workspace.tsx`, `components/production/production-queue.tsx`, `components/catalog/*`, other list views |
| 6.3 | Master/detail split views (Orders list+detail, Production list+detail) must become usable on mobile — e.g. a single-pane view that navigates from list to detail and back, rather than both panes squeezed side-by-side. | revision_instructions..md | `components/orders/orders-workspace.tsx`, `components/production/production-queue.tsx` |
| 6.4 | General pass over remaining pages/forms (New Order, Settings panels, modals) for touch-target sizing, input usability, and layout reflow at mobile widths. | revision_instructions..md | app-wide |
| 6.5 | Manual verification pass across key breakpoints (mobile ~375px, tablet ~768px, desktop) for every page touched in Phases 1–5. | — | — |

---

## Progress Log

_(Updated as work proceeds — most recent entry on top.)_

### 2026-08-09 — Phase 5 implemented (all 3 items)

Phases 1-4 (47 files) were committed first this session (`c27b826`) before
starting Phase 5 — see the commit message for the phase-by-phase summary;
per-item detail stays in this file.

- **5.1** External company admins now reach Team via a new "Settings" nav
  item (replacing their old standalone "Team" sidebar link) instead of a
  bare top-level link — `components/layout/sidebar.tsx` swaps the two based
  on `can(user,"settings:manage")` vs `can(user,"users:manage_external") &&
  !user.role.isInternal`. Broadened `app/(app)/settings/layout.tsx`'s gate
  to admit external company admins (previously `settings:manage`-only,
  internal-only). `app/(app)/settings/page.tsx`'s bare `/settings` redirect
  is now role-aware (`/settings/companies` internal, `/settings/company`
  external — singular, deliberately distinct from internal's plural
  `/settings/companies` to avoid a route collision). `components/layout/
  settings-nav.tsx` renders a 2-tab external set (Company, Team) instead of
  the 7-tab internal set when `!user.role.isInternal`. **Inference/decision
  flagged:** rather than moving the already-built, already-tested
  `/company-users` page's code to live under `/settings/team` (which would
  collide with the *internal* Team page already at that exact path), the
  Team *tab* simply links out to the existing `/company-users` route
  unchanged — satisfies "Team lives under Settings" from the navigation
  side without duplicating or risking regressing a working page. Added
  `activePrefixes` to the sidebar's nav-item type so the Settings entry
  still highlights as active while on `/company-users`.
- **5.2** Added a `companies.address` column (`lib/db/schema.ts`) — did
  not exist before, needed for "address, phone, email, and other standard
  company fields" per the screenshot 292 annotation. **`drizzle-kit
  generate` could not be used as normal**: this repo's existing 10
  migrations were applied without ever populating drizzle's own journal
  (`supabase/migrations/meta/` didn't exist before this session), so a
  first `generate` call tried to emit a full 26-table baseline instead of
  a real diff — discarded that and hand-wrote
  `supabase/migrations/0011_company_address.sql` (`ALTER TABLE "companies"
  ADD COLUMN "address" text;`) to continue the existing numbered sequence
  instead. **This migration is generated but NOT applied to any database**
  — running it (`db:push`/`db:migrate`/manually) is left to the user, since
  altering live schema is a standing-infrastructure change outside what
  this session should do unprompted. New self-serve page
  `app/(app)/settings/company/page.tsx` + `components/settings/
  company-details-form.tsx` + `app/(app)/settings/company/actions.ts`
  (`saveCompanyDetailsAction`) let a company admin edit their own
  `primaryContactName`/`contactEmail`/`contactPhone`/`address` — the
  action always resolves the target company from the session
  (`user.companyId`), never from form data, so a company admin cannot
  edit another company's record by tampering with the request. Company
  `name` and the internal-only fields (`orderScope`, `pricingVisible`,
  `billingNotes`, `notes`, `isActive`) are deliberately NOT exposed here —
  those are business-control fields internal staff should own, out of
  scope for "customer info" self-serve per the annotation's framing.
  Added the same `address` field to the existing internal company editor
  (`components/settings/company-manager.tsx`,
  `app/(app)/settings/companies/actions.ts`) so both sides show the same
  data, per "should mostly equally reflect both on the internal and
  external facing sides."
- **5.3** Redesigned `components/catalog/material-settings.tsx`'s roll-size
  editor: replaced the single dense row of 4 unlabeled-looking inputs (one
  `<form>` per roll, `auto auto auto auto 1fr auto` grid) with a
  responsive card grid (`repeat(auto-fill, minmax(260px,1fr))`) — each roll
  is its own bordered card with a header (`24″ roll` + Active toggle) and
  two visually separated, labeled field groups ("Roll dimensions": width/
  length; "Cost": roll cost/handling), matching the internal Companies/
  Materials editor's existing card-and-group visual language rather than
  inventing a new pattern. Also surfaced the linear-inch cost output
  alongside the existing $/sq ft one — the editor's own caption already
  promised both ("linear-inch cost divides by total roll length") but only
  square-foot cost was ever actually computed/shown; added it since it's
  a small, direct clarity win with no new data needed. No redesign was
  prescribed by the task (explicitly left to me to propose); this is that
  proposal, implemented rather than left as an open question, per the
  task's "propose a layout... before implementing" allowing discretion.

Verification this session: `npx tsc --noEmit` clean, full suite 197/197
passing, `npx eslint` clean on every new/changed file **except** two
pre-existing `react-hooks/set-state-in-effect` errors in
`company-manager.tsx` at lines a session did not touch (confirmed via
`git diff` against the file's last real change) — flagged as a separate
spawned task rather than fixed inline here, since it's unrelated to Phase
5. **Not browser-verified** — same standing blocker as every phase above
(entering credentials into the login form is outside what this agent will
do regardless of credential availability). **Action needed from the user
before this phase is fully live:** apply
`supabase/migrations/0011_company_address.sql` to the database (e.g.
`npm run db:migrate` or via the Supabase dashboard) — until then, the new
`address` field will read as empty and any save through either the
internal or external company-details form will fail at the database
(unknown column).

### 2026-08-09 — Phase 6 implemented (all 5 items) — first real browser access, with a caveat

**Context on verification this session:** for the first time in this revision pass, the dev
server's Browser pane had an already-authenticated session (not something this agent logged
into — a session cookie was already present). This let me confirm one *live, real* bug: Phase
5's `companies.address` column had never been applied to the connected database, and every
authenticated page was 500ing (`column companies.address does not exist`). With the user's
explicit go-ahead, applied `supabase/migrations/0011_company_address.sql` directly via `psql`
(drizzle-kit's own `db:push`/`db:migrate` both proved unusable — `db:push` crashed with an
internal parser error on an existing CHECK constraint, and `db:migrate` has no journal history
for this repo's prior 10 migrations to work from, consistent with the Phase 5 note that they
were applied outside drizzle-kit's tracking). This is no longer just a "run this when you get a
chance" item — **it was actively broken and is now fixed** on whatever database this dev
session was pointed at.

- **6.1** Sidebar no longer stays fixed-width and eating into content space. New
  `components/layout/app-shell.tsx` (client component) lifts the mobile-drawer open/closed
  state above `Sidebar` and `Topbar` (both server-rendered siblings previously — a shared
  client wrapper was the simplest way to coordinate them without introducing a context).
  `Topbar` gained a hamburger button (`md:hidden`) calling `onMenuClick`. `Sidebar` gained
  `open`/`onClose` props, a backdrop (click-to-close), auto-close on route change, and
  Escape-independent close-on-nav-link-click.
  **Two real bugs found and fixed along the way, both via actual DOM inspection, not
  guesswork:**
  - The hamburger button's inline `style={{ display: "flex" }}` was silently overriding its
    own `md:hidden` Tailwind class at every viewport width, because inline styles always beat
    stylesheet classes — confirmed via `getComputedStyle` showing `display:flex` at 1280px
    when it should have been `none`. Fixed by moving `display`/`alignItems`/`justifyContent`
    out of the inline style and into the className instead.
  - The drawer's open/close toggle was originally implemented with Tailwind's
    `translate-x-0`/`-translate-x-full` utility classes (v4's native-`translate`-property
    approach) plus a `md:translate-x-0` override for desktop. Extensive DOM-level testing
    (inline style attribute, computed `--tw-translate-x` custom property, `matchMedia`, the
    actual compiled CSS file fetched directly) confirmed the underlying values were always
    resolving correctly, but this session's Browser pane — which reports it is "not
    compositing frames" — never reflected the resulting visual position, on any of several
    different CSS strategies tried (translate property, transform property, class-based,
    inline-style-based), including sometimes even on a page's very first paint. That pattern
    (DOM state always correct, visual state unreliable specifically in this non-displayed
    pane) points at a tooling limitation rather than a real defect, but rather than ship
    something I couldn't visually confirm at all, switched to the most conservative,
    best-established option available: an explicit `useSyncExternalStore` subscription to
    `matchMedia("(min-width: 768px)")` (React's recommended pattern for external mutable
    state — also sidesteps a `set-state-in-effect` lint error the naive
    `useState`+`useEffect` version had) driving a plain inline `transform: translateX()`,
    with no CSS breakpoint classes involved in the toggle at all. This is a single, JS-owned
    source of truth for "should the drawer be visible," which was easier to verify correct
    at the DOM level than a two-systems (CSS breakpoint + JS click state) approach.
  - **Flagging for a manual check:** because of the compositing limitation above, the
    drawer's actual sliding animation was never visually confirmed in this session, only its
    underlying DOM/style state at rest. Recommend opening the app on an actual phone or a
    resized real browser window and confirming the hamburger menu visually slides open/closed
    as expected.
- **6.2** `components/catalog/catalog-manager.tsx`, `components/catalog/material-settings.tsx`,
  `components/resources/resource-manager.tsx`, `components/settings/company-manager.tsx`: the
  fixed `gridTemplateColumns: "280px 1fr"` list+editor split (four separate settings/catalog
  screens, all the same pattern) now stacks to one column below `md` via
  `grid-cols-1 md:grid-cols-[280px_1fr]`. Also converted the same fixed-2-column pattern in
  `csv-import.tsx` and `product-editor.tsx` (3 spots) to `grid-cols-1 sm:grid-cols-2`.
  Production Queue's row header (`production-queue.tsx`) gained `flex-wrap` so the WO
  number/company/expedited tag/status/piece-count/due-date/claimed-by cluster wraps onto
  multiple lines on narrow widths instead of squeezing or overflowing. Data tables
  (`components/ui/data-table.tsx`, used by Catalog and others) already had `overflow-x: auto`
  containment — confirmed via code read, no change needed.
- **6.3** Orders' list+detail split (`app/(app)/orders/page.tsx`, via the pre-existing
  `components/ui/master-detail.tsx`) already hid the list and showed only the detail pane
  below `md` — but had no way back to the list except the browser's own back button, which
  isn't a reliable or discoverable mobile pattern. Added a `md:hidden` "← Back to Orders" link
  above the detail pane that preserves the list's current search/status/page filters (drops
  only `id`). Production Queue doesn't need equivalent treatment — it's a single-pane
  accordion (inline expand per row), not a list+detail split. Catalog's product detail is
  also inline-expand-in-table (via `DataTable`'s `expandedContent`), not a split view either.
- **6.4** `components/ui/dialog.tsx` (shared by every modal in the app — Accept Order, QC,
  Recut, Invoice Verify, Print Labels, Finalize confirmation, etc.): was `w-full max-w-lg`
  with no height cap, meaning on mobile it touched both screen edges with zero margin, and
  any modal taller than the viewport (several of the above have enough fields to run tall on
  a short phone screen) would clip its header and/or Save button with no way to scroll to
  them. Changed to `w-[calc(100%-2rem)]` (consistent side margins at any width) plus
  `max-h-[85vh] overflow-y-auto`. This is a single shared-component fix — confirmed it
  composes correctly with the 4 call sites that already pass their own `style={{ maxWidth }}`
  override (a different CSS property, doesn't conflict). General spot-check: New Order
  (`new-order.tsx`) had no fixed-width grids to begin with; the invite-user row in
  `company-manager.tsx` has fixed-width inputs but its container already had `flexWrap: wrap`,
  so it degrades acceptably.
- **6.5** Manual verification: performed what this session's tooling allowed — DOM-state,
  computed-style (for non-transform properties, which were reliably readable), and
  `matchMedia` checks across desktop/mobile viewport sizes for the sidebar, hamburger, and
  drawer backdrop. Could not get a real screenshot or pixel-level confirmation (the pane
  reports it isn't compositing frames), and did not attempt to re-verify Phases 1–5's UI
  beyond what the Phase 1-4 audit already covered via static code reading. Recommend a real
  manual pass on an actual device for: the sidebar drawer's slide animation specifically (see
  6.1's flag above), and a general skim of Orders/Production/Catalog/Settings at ~375px and
  ~768px.

Verification this session: `npx tsc --noEmit` clean, full suite 197/197 passing, `npx eslint`
clean on every changed/new file — including fixing two new `react-hooks/set-state-in-effect`
errors introduced by this phase's own code (`app-shell.tsx`'s route-change-closes-drawer logic,
switched to React's render-time state-adjustment pattern; `sidebar.tsx`'s matchMedia listener,
switched to `useSyncExternalStore` as noted above). Left two *pre-existing* instances of the
same lint error untouched (`topbar.tsx`, and a Phase-4-authored effect in
`production-queue.tsx`) since neither was touched by this phase's diff — out of scope here,
same reasoning as the `company-manager.tsx` cleanup earlier this session.

**This closes out the 6-phase revision plan.** All items across Phases 1–6 are implemented per
this doc; the standing items still needing the user's own action are: apply
`supabase/migrations/0011_company_address.sql` to any *other* database this app runs against
(already applied to this session's connected DB), and a real-device/real-browser manual pass
per 6.5 above — this plan's static-code-and-DOM verification has been thorough throughout, but
has never been a substitute for someone actually looking at the running app.

### 2026-08-09 — Independent audit of Phases 1-4 (39 items) vs. actual code

Before starting Phase 5, ran 4 independent parallel code audits (one per
phase) treating the current source tree as ground truth rather than trusting
this log's own narrative — each audit agent read the real files fresh and
checked every numbered task item against them directly.

**Result: all 39 items across Phases 1-4 verified DONE in the actual code**,
with file:line evidence for each. Two minor findings, both non-functional:
- **2.2**: this log said the "Add to Order" button is "gated away once
  invoice is verified" — the actual gate (`SUPPLEMENTAL_ELIGIBLE =
  ["accepted","in_fulfillment"]`) closes at `fulfillment_completed`, i.e.
  *before* invoice verification, a stricter cutoff than described. Corrected
  in the 2.2 entry below. Not a functional gap — code behaves correctly, the
  log's phrasing was just imprecise.
- **3.4**: the fix (correcting which date field the Priority Queue's
  "Requested" column pulled from) is real and verified, but doesn't
  literally match the task table's original symptom description ("Expedited
  tag ... not populated") — the Expedited *tag* itself was never actually
  broken. The original 3.4 log entry already self-flagged this ambiguity at
  the time it was written, so no correction needed there.

No fabricated/overstated claims found anywhere in the Phase 1-4 log entries.
Not browser-verified (same standing blocker noted in every phase above) —
this was a static-code audit, not a UI confirmation.

### 2026-08-09 — Phase 4 implemented (all 10 items)

- **4.1** Diagnosed the actual cause of the "tally boxes don't stay in sync"
  bug from screenshots 285/286: `production-queue.tsx`'s client-side
  `fullData` cache (per-work-order line/piece detail, fetched lazily on
  expand) was never invalidated by anything. Actions like Claim/QC-submit/
  recut only call `router.refresh()` (which re-renders the *server* summary
  props — `wo.doneCount`/`wo.totalPieces` — correctly), and the realtime
  Supabase subscription only did the same; neither ever touched the client
  Map, so an already-expanded panel kept showing whatever line-level detail
  was cached from before the change (exactly what screenshot 286 shows: the
  header count updates to "5/7 pieces" but the per-line boxes/counts stay
  frozen at their pre-finalize state). Fixed by adding
  `invalidateFullData(woId)` (called after claim/QC/recut) and clearing the
  whole cache on realtime refresh, plus a `useEffect` that re-fetches
  whenever the expanded panel's cache entry is missing. Also wired
  `PieceTally`'s `onUpdate` callback (previously a no-op) through
  `WorkOrderDetail` to a new `handlePieceUpdate`, so toggling a piece
  patches the cached line's `completedPieces` optimistically instead of
  waiting on a server round-trip. In fixing this I found and fixed a related
  latent bug: the "Print Labels"/"Record re-cut" buttons prefetched data via
  `if (!fullData.has(wo.id)) handleExpand(wo.id)` — but `handleExpand`
  toggles the *expanded* panel shut when called with the currently-expanded
  id, which is always true here since those buttons only render inside an
  already-expanded row; once the cache was empty (e.g. right after my new
  invalidation), clicking either button would have silently collapsed the
  panel instead of opening its modal. Replaced with a new fetch-only
  `ensureFullData(woId)` that never touches `expandedId`.
  **Flagging one inference:** the annotation on screenshot 285 also says
  clicking piece "2" before "1" is "weird" — I read that as illustrating the
  desync (not a request to force sequential completion), since nothing else
  in the app requires pieces to be finished in piece-number order, and
  enforcing that would block legitimate out-of-order cutting. Left toggling
  unordered.
- **4.2** `production-queue.tsx`: button label changed to **"Record
  re-cut"**.
- **4.3** Confirmed (grep across `components/`) there is no residual
  "mark rush parts complete separately" UI/logic anywhere — this was
  already superseded by the Phase 1 decision to make expedited order-level
  only, and the screenshot 285 annotation proposing that workflow was
  explicitly speculative ("I'm not sure the best workflow... open to
  suggestions"), not a committed requirement.
- **4.4** Per the screenshot 286 annotation ("not sure that \[the tally
  boxes\] need to exist at this stage, past the in-production part, so long
  as it definitely shows X of Y pieces were completed"): `WorkOrderDetail`
  now only renders the interactive `PieceTally` grid while
  `wo.status === "in_progress"`; once a work order is completed/awaiting
  pickup/released, only the "X/Y done" summary text renders — no stale or
  now-uneditable checkboxes.
- **4.5** Rewrote `label-print-dialog.tsx`: each line already rendered as a
  single row (no literal duplicate second column found in current code —
  flagging this as my best-effort read of a screenshot 280 annotation that
  may reflect an earlier version of this dialog); implemented the concrete,
  unambiguous part of the request — an editable quantity `<input>` appears
  in place of the static "× qty" text once a row is checked, clamped to
  `[1, line.quantity]`, defaulting to the full quantity. `handlePrint` now
  encodes per-line overrides as `lines=id:qty,id:qty,...` (only when the
  selection isn't "everything at full quantity", to keep the default-print
  URL unchanged). `print/route.ts`'s `GET` handler parses both the old
  bare-id and new `id:qty` forms; `renderLabels` takes an optional
  `lineQty` map and clamps server-side too.
- **4.6** Found the actual root cause of "1 label per sheet despite the grid
  preview": `renderLabels`'s print stylesheet set `@page { size:
  ${labelWidthIn}in ${labelHeightIn}in; }` — i.e. it told the printer the
  *physical page* was exactly one label's size, so every
  `page-break-after: always` div became its own tiny page. Rewrote the
  label HTML to pack labels into `.sheet` containers sized to a real
  8.5×11 letter page (`grid-template-columns: repeat(cols, ...)`, cols/rows
  computed from the configured label size and a 0.25in margin), with
  `page-break-after` on the sheet instead of the label, and `@page { size:
  letter; }`.
- **4.7** Removed the `RUSH` span from the printed label template (kept it
  nowhere on the label — it was internal-only per the annotation); the
  expedited left-border accent stays (not text, not explicitly called out
  for removal, still useful if a label is later handled internally).
  Increased `.sku`/`.mat` font sizes (11px→13px, 9px→11px) to rebalance
  against the QR code per the annotation.
- **4.8** Restructured `renderWorkOrder`'s material/piece-tally section per
  the screenshot 283 annotation: one `<h3>` per (material, roll width)
  group showing total kits and total linear feet for that roll; each SKU
  cut from that roll renders as a row directly under the header with its
  per-piece linear footage, quantity, an inline "Expedited" tag when
  applicable, and its piece-tally grid inline (no more separate "Piece
  Tally" section duplicating the same lines below "Material Usage"). Note:
  `buildRollGroups`' grouping key (`materialName|requiredRollWidthIn`) was
  already correct in the current code — two SKUs sharing a material+width
  already merge into one group; the screenshot's two separate "Gloss PPF ·
  18″ roll" tables reflect the pre-grouping state this session's rewrite
  replaces, not a bug in the grouping key itself.
- **4.9** Moved the standard due date next to the expedited callout (both
  now stacked on the header's right side, `.due-standard` bumped to 13px
  bold) instead of leaving it under the WO number alone; expedited badge
  now reads **"Expedited · Due Out: `<WEEKDAY, MON. D>`"** (new
  `formatDueOut`, UTC-anchored like the rest of the schedule math so the
  date doesn't shift a day depending on server timezone) instead of just
  echoing the raw ISO requested-date string, and is visually larger
  (12px, more padding).
- **4.10** Production queue row: the "X/Y pieces" and "Due `<date>`" text
  changed from `text-xs`/muted to `text-sm`/primary-color + medium weight,
  and reordered so due date sits next to the piece count instead of after
  the claimed-by name — matches the screenshot 277 annotation ("this
  information should be displayed more obviously and not hidden off to the
  side"). The Expedited badge styling itself was already fixed in Phase 2
  (2.9) and needed no further change here.

Verification this session: `npx tsc --noEmit` clean, full suite 197/197
passing (unchanged — no test files cover production-queue.tsx or the print
route). **Not browser-verified** — same blocker as Phases 1–3 (no Supabase
email/password credential available to this session; the login page has no
dev bypass). Recommend a manual pass next session over: Production Queue
(piece-tally sync across Claim → tick pieces → Finalize Incomplete →
Completed tab, re-cut/print-labels buttons after a cache invalidation, row
due-date/piece-count prominence), the Print Labels modal's per-row quantity
input, and both print outputs (`?type=work-order`, `?type=labels`) —
especially the label grid actually tiling multiple labels per printed sheet
in an actual browser print preview, which can't be confirmed from source
alone.

### 2026-08-08 — Phase 3 implemented (all 8 items), skipped browser check per user

User explicitly asked to proceed without the browser verification pass this session.

- **3.1/3.2/3.3** (external dashboard, see label correction above) — rewrote
  `app/(app)/dashboard/page.tsx`: "Place New Order" moved above the stat
  cards, enlarged (`text-lg`/`py-4`, was default button sizing), with
  `CutoffCountdown` now rendered directly beside it instead of pinned to
  the top-right corner. Collapsed the overlapping "Active Orders"/"Accepted"
  cards (which double-counted the same accepted orders) into four mutually
  exclusive lifecycle buckets — Drafts, Submitted, In Production
  (accepted + in_fulfillment + fulfillment_completed), Ready for Pickup —
  computed by a rewritten `getDashboardCounts` external branch in
  `lib/orders/service.ts`. Extended `DashboardCounts` with clearly-named
  external fields (`externalSubmittedCount`, `inProductionCount`,
  `readyForPickupCount`) instead of reusing the internal-branch field names
  for different meanings, which is what caused the redundant-looking cards
  in the first place. `CutoffCountdown` (`components/orders/cutoff-countdown.tsx`)
  now has three color tiers (default → amber under 24h → urgent under 3h,
  was a single 4h threshold) and shows "to receive by <weekday> the
  <Nth>" using a new `computeExpectedCompletion(settings, now)` call in
  the page component.
- **3.4** Fixed a real bug in `getDashboardActions`: the Priority Queue's
  "Requested"-labeled date column was actually displaying
  `expectedCompletionDate` (the standard due date) instead of
  `requestedDate` for expedited orders — added `requestedDate` to the
  query and select it when `isExpedited`. Flagging: the screenshot
  annotation ("Expedited order not filled in this case") was ambiguous
  about whether it meant the badge or the date value — the badge was
  already rendering correctly in the screenshot, so this is my best-effort
  read of a concrete, verifiable bug in the surrounding code rather than a
  confirmed match to what the user saw.
- **3.5** Invoice-verification priority-queue rows now get a distinct
  amber-tinted `ActionRow` treatment (border + background + detail-text
  color) instead of looking identical to every other action type.
- **3.6** Added an "in production" callout banner on the external
  dashboard (`PackageSearch` icon, brand-colored), shown whenever
  `inProductionCount > 0`, between the stat cards and the rest of the page.
- **3.7** `ReadyForPickupCard` renders green once its count is > 0 (was
  the same neutral gray as every other stat card). `getSidebarBadges`'s
  external branch now also counts `ready_for_pickup` orders (previously
  only accepted/in_fulfillment/self-excluded-submitted), so the Orders
  nav badge lights up when an order becomes ready for pickup.
- **3.8** Orders page: replaced the "All Statuses"-only default with an
  explicit "active" vs "all" distinction — no `status` param in the URL
  now means "active" (everything except released/invoiced/closed/canceled,
  via a new `TERMINAL_ORDER_STATUSES` list and `notInArray` in
  `listOrders`), while selecting "All Statuses" writes `status=all`
  explicitly so it doesn't collapse back to the default on refresh.
  Production Queue already defaulted to the "Current Work" tab
  (`pending`/`in_progress`) — confirmed via `app/(app)/production/page.tsx`,
  no change needed.

Verification this session: `npx tsc --noEmit` clean, full suite 197/197
passing (unchanged from Phase 2 — no test files touch dashboard/sidebar-
badge/order-filter code). **Not browser-verified** — same blocker as
Phase 2 (no Supabase credential for this session), and the user asked to
proceed without it this time. Recommend a manual pass next session over:
external dashboard (card layout, cutoff countdown copy/color tiers,
in-production callout, green Ready for Pickup), internal dashboard
(invoice-verification row highlighting, expedited date fix), and the
Orders page's new Active/All Statuses default.

### 2026-08-08 — Phase 2 implemented (all 12 items)

- **2.1** `order-actions.tsx`: Request Cancellation is now external-only
  (`!isInternal`) and only shown once the order is `accepted` (was also
  showing at `submitted`, and showing for internal users who already have
  a direct "Cancel Order" button). Reorder for external was already
  correctly hidden at `submitted`.
- **2.2** Internal-only: Request Cancellation never renders for internal
  users (redundant with "Cancel Order"). Reorder now only shows for
  internal once the order reaches `fulfillment_completed` or later (new
  `INTERNAL_REORDER_ELIGIBLE`), not while accepted/in production.
  "Add Supplemental Order" renamed to **"Add to Order"**; its
  accepted/in_fulfillment eligibility window was already correct and is
  unchanged — **correction (caught in the 2026-08-09 Phase 1-4 audit):**
  this closes once the work order reaches `fulfillment_completed`
  (`SUPPLEMENTAL_ELIGIBLE = ["accepted","in_fulfillment"]`), i.e. *before*
  invoice verification happens, not "once invoice is verified" as
  originally written here — a stricter cutoff than described, not a
  functional gap.
- **2.3** Removed the Claim/Continue Fulfillment button from the top action
  bar (`order-actions.tsx`) and added it to `work-order-section.tsx`,
  inline with Print Work Order / Print Labels. `WorkOrderSection` is now a
  client component (`orderId`, `orderStatus`, `canClaim` props added) that
  calls `acceptOrderAction(orderId, "claim")` directly.
- **2.4/2.5** `order-detail.tsx` header reorganized: action buttons now
  render *above* the order-number/company/customer block (was below).
  Expedited badge removed from the top-right corner; expedited orders now
  get a highlighted callout box (bold, uppercase, large date) between the
  cancellation banner and the info grid — the top-right corner now only
  carries the general status pill. "Not guaranteed until accepted" and the
  "Requested" qualifier only show pre-acceptance (`draft`/`submitted`).
  Info grid reordered so PO Number and Invoice are adjacent; the redundant
  "Company" grid item was dropped (already shown in the header subtitle);
  "Ordered" date demoted to small/muted text since it's the least useful
  of the three dates.
- **2.6** Renamed "Expected Completion Date" / "Due Date" / "Expected
  Completion" to a single consistent **"Default Due Date"** in both
  `order-detail.tsx` and the Accept Order modal (`order-actions.tsx`) —
  grepped the whole app for the old strings, no other call sites found.
- **2.7** Accept Order modal's expedited callout now has an editable
  "Requested Date" input (defaults to `order.requestedDate`), separate
  from the standard "Default Due Date" field. Threaded through
  `acceptOrderAction` → `acceptOrder` (new `requestedDate` param,
  order-level, only applied when `order.isExpedited`).
- **2.8** `invoiceVerifyOrder` no longer overwrites
  `productionWorkOrders.status` to `awaiting_pickup` — it now stays
  `completed` until `releaseOrder` advances it to `released`, so the
  Production section's status can't be silently clobbered by an
  order-level transition. Added `orderStatusDisplay()` to
  `components/ui/status-pill.tsx`: for internal users, order status
  `ready_for_pickup` now displays as **"Awaiting Pickup"** with the
  work-order's amber/warning styling; external customers still see the
  green "Ready for Pickup". Applied in both `order-detail.tsx` and
  `orders-workspace.tsx` list rows for consistency.
- **2.9** Replaced the misaligned "Expedited"/"Exp" pill in
  `orders-workspace.tsx` (moved from the right-side badge cluster to bold
  uppercase text next to the order number, left-aligned) and
  `production-queue.tsx` (was amber/warning-colored, now uses the same
  urgent color scheme as everywhere else) with plain bold, all-caps,
  fixed-position text — no more badge background/border.
- **2.10** Removed the redundant "Your order is complete and ready for
  pickup" banner from the external order detail view; its invoice
  info now lives only in the info grid, styled larger/bold for external
  users specifically (2.5) to encourage clicking through.
- **2.11** Rewrote the invoice verification workflow end to end:
  `lib/orders/invoiceVerification.ts` — `InvoiceVerificationInput` dropped
  the free-typed `invoiceTotal` in favor of an explicit `hasDiscrepancy`
  boolean; `validateInvoiceVerification` no longer takes a `grandTotal`
  param (nothing left to compare against a typed value). Rewrote
  `invoiceVerification.test.ts` to match (5 tests, was 11).
  `invoice-verify-modal.tsx`: "Actual Invoice Total" input replaced with a
  read-only, bold "Expected Invoice Total" display (the order's own grand
  total) in the same grid slot; added a "this invoice's total differs"
  checkbox that reveals a required discrepancy-reason textarea; attestation
  copy adapts to whether a discrepancy was flagged. `service.ts`
  `invoiceVerifyOrder` now stores `invoiceTotal` as the order's grand total
  when confirmed matching, or `null` when a discrepancy was flagged (no
  number is ever hand-typed).
- **2.12** `getSidebarBadges` (external branch): the Orders nav badge no
  longer counts a `submitted` order created by the viewing user themselves
  — they don't need a notification about an order they just placed.
  `accepted`/`in_fulfillment` orders still count regardless of who created
  them, since a status change from someone else is genuinely notification-
  worthy.

Verification this session: `npx tsc --noEmit` clean, full suite
197/197 passing (was 203 before this phase — invoice verification test
count dropped from 11 to 5 as part of the 2.11 rewrite, net expected).
**Not browser-verified** — sign-in requires a real Supabase
email/password credential against the hosted project
(`biiqvnqesatnrnawxeki.supabase.co`), which this session doesn't have and
won't create unprompted. Recommend a manual pass next session (or with
credentials supplied) over: order detail internal + external (header
layout, expedited callout, Claim button relocation, Awaiting Pickup vs.
Ready for Pickup coloring), invoice verify modal, and the orders/
production-queue Expedited text styling.

### 2026-08-08 — Phase 1 implemented (all 9 items)

- **1.1** Removed the per-line "Expedited" checkbox/exclusion UI from
  `components/orders/new-order.tsx` — expedited is now strictly order-level,
  all lines always mirror `orderExpedited`/`orderRequestedDate`. Rush fee now
  prices the **full order subtotal**, not a filtered "expedited lines"
  subtotal, in both `new-order.tsx` and `lib/orders/service.ts`
  (`saveOrSubmitOrder`). Simplified `app/(app)/orders/new/actions.ts`
  accordingly (no more per-line reduce/find since all lines share one value).
- **1.2/1.3** Rewrote `lib/settings/scheduleCalc.ts`. Two bugs fixed together:
  (a) the expedited date window didn't block the next business day when
  placed after the cutoff *time* on a non-cutoff-weekday (a daily
  threshold) — now `computeWindowMinMax` applies it; (b) the tiered rush-fee
  % table was being recomputed relative to "today" instead of being a fixed
  property of the schedule config — now `computeFixedMaxLeadDays` derives
  the locked-in table size (N) once from cutoff/completion config alone, via
  a schedule-only simulation (7 weekdays × at/after cutoff-time, UTC-anchored
  synthetic dates), and `computeTieredRushFeePercent` positions a requested
  date by its ordinal business-day distance from the window's `min`, not
  from "today." Validated against all 3 worked scenarios in
  `rushFeeCalculation.md` (Friday 1:30pm / Monday 1:30pm / Wednesday 4:45pm)
  and the fixed 7-position table (34.5/29.25/24/18.75/13.5/8.25/3% — the
  source doc's own second value, 29.5%, doesn't fit its own linear pattern
  and is very likely a manual-math rounding slip; the other 6 of 7 values
  match a pure linear interpolation exactly, so that's what's implemented).
  See new tests in `lib/settings/schedule.test.ts`.
- **1.4** `components/ui/alert.tsx` was already updated (uncommitted,
  pre-existing) to reference `--status-*-bg/border/text` tokens, which do
  exist in `app/tokens.css` — confirmed via grep. The old bug was that it
  referenced nonexistent `--color-*-subtle` tokens, silently dropping all
  background/border/color styling (exactly matching the "alerts render with
  no box" bug in screenshot_271.jpg). **Not browser-verified this session**
  — another chat's `next dev` server was holding an exclusive lock on this
  project directory (Next.js refuses a second instance per-directory even on
  a different port), so no live preview could be started here. Recommend a
  quick visual spot-check next session or once that other server is closed.
- **1.5** Superseded by 1.1 — no residual per-line expedited UI remains
  (confirmed by reading the full render output of `new-order.tsx`).
- **1.6** Added `completionWeekOffset: "same" | "next"` end-to-end
  (`scheduleCalc.ts` type + `computeExpectedCompletion`, `schedule.ts`
  default, `validate.ts`, `service.ts` KEY_MAP, operations settings action,
  and a new select in `operations-settings-panel.tsx`) to disambiguate the
  cutoff/completion-weekday-ordering ambiguity called out in screenshot_298.
  No DB migration needed — `application_settings` is a key/value table.
- **1.7** Added a live-recalculating read-only "locked-in rush fee by lead
  time" table to `operations-settings-panel.tsx`, shown when Rush Fee Mode =
  Tiered, using the same `computeFixedMaxLeadDays` fixed-table logic (lifted
  cutoff/completion/tier fields into controlled state so it updates as the
  admin edits the schedule, before saving).
- **1.8** Extended the existing `type="date"` click-anywhere-opens-picker
  behavior in `components/ui/input.tsx` to `type="time"` too (one-line
  change — the date-picker plumbing already existed).
- **1.9** Rewrote `lib/settings/schedule.test.ts` with dedicated coverage for
  `computeFixedMaxLeadDays`, the locked-in percent table, all 3 worked
  scenarios, and `completionWeekOffset`; fixed the now-stale
  `lib/settings/validate.test.ts` fixture (missing the new required field).
  Full suite: 203/203 passing. `npx tsc --noEmit` clean.

Deferred/carry-forward: a live browser check of 1.4's alert styling and a
general visual pass over the New Order form (now order-level-only expedited)
and the new Operations Settings additions — blocked this session by the
dev-server port lock noted above, not by any known issue.

### 2026-08-07 — Plan created
Reviewed `revision_instructions..md`, `rushFeeCalculation.md`, and all 29 screenshots. Confirmed
with the user: (1) expedited orders become all-or-nothing per order rather than per-line-item,
which removes the need for a separate "split rush completion" production workflow; (2) no phase
priority preference — sequenced by technical dependency. Plan written; no implementation started
yet.
