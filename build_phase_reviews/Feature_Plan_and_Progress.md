# Feature Pass — Plan & Progress

Source material: user request (2026-08-09) listing 6 items, prioritized in order. Tracked
separately from `Plan_and_Progress.md` (the prior 6-phase post-build revision pass, now closed
out) since this is a new, unrelated batch of work — phases below are "Phase N" of *this* doc,
not a continuation of that one's numbering.

**Item → Phase mapping** (see the approved plan for full detail,
`C:\Users\mjager\.claude\plans\dynamic-inventing-music.md` — that file is a one-time approval
artifact outside the repo; this doc is the durable one):

| # | Item | Phase |
|---|---|---|
| 1 | Time/timezone consistency (dashboard countdown + everywhere else) | Phase 1 |
| 2 | Company page shows external users for that company (remove/reset) | Phase 2 |
| 3 | Bulk-import the 152 catalog item files | Phase 3 |
| 4 | Per-file visibility control (download / view-only / internal-only) | Phase 3 |
| 5 | CSV bulk upload of order line items, from within the New Order form | Phase 4 |
| 6 | Motorcycle↔kit compatibility matrix | Deferred — waiting on 2 reference Excel files |

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

**Status: Not Started**

| # | Task | Files |
|---|------|-------|
| 4.1 | Add "Bulk Upload" button + modal (template download, drag-drop upload) | `components/orders/new-order.tsx` |
| 4.2 | Parse via existing `parseCsv`, validate SKU/material/quantity against `products` prop, show per-row error preview | `components/orders/new-order.tsx`, reuses `lib/catalog/csv.ts` |
| 4.3 | Commit valid rows into `lines` state on confirm | `components/orders/new-order.tsx` |

## Deferred — Compatibility matrix (item 6)

Waiting on the user's 2 reference Excel files before any schema/design work starts.

---

## Progress Log

_(Updated as work proceeds — most recent entry on top.)_

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
