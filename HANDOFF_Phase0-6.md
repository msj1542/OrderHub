# OrderHub — Cumulative Handoff: Phase 0 → Phase 6

> **Purpose.** This document gives a new conversation everything needed to resume
> work from after Phase 6 into Phase 7 with no loss of context.
> Created: 2026-08-06. Updated: 2026-08-06 (Phase 6 complete; supersedes
> `HANDOFF_Phase0-5.md`). Update this document after completing each phase.

---

## Key Reference Documents

| Document | What it contains |
|---|---|
| [`REBUILD_PLAN.md`](REBUILD_PLAN.md) | Full architecture decisions, build order, phase-by-phase checklist, UX improvements |
| [`CLAUDE.md`](CLAUDE.md) | Codebase instructions, reference app location, rebuild rules, never-edit list |
| [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md) | Phase 5 completion summary (invoice verification, release/close, reorder/supplemental, build-blocking fixes) |
| [`build_phase_reviews/Phase6_Completion.md`](build_phase_reviews/Phase6_Completion.md) | Phase 6 completion summary (notifications, resources, settings hub, Realtime) |
| `original-reference/` | **READ-ONLY.** Reference app at `C:\Users\mjager\Documents\Codex\2026-07-29\...\work\site`. Source of truth for behavior, copy, visuals. Never edit. |

Earlier phase reviews: `Phase2_Completion.md`, `Phase2_Audit_1.md`, `Phase2_Audit_2.md`,
`Phase3_Completion.md`, `Phase3_Audit_1.md`, `Phase3_Audit_2.md`,
`Phase4_Completion.md`, `Phase4_Audit_1.md`, `Phase4_Audit_2.md`.

---

## Environment Variables (`.env.local`)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL (see Supabase dashboard)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service-role key (bypasses RLS — server-only)

# Database (Supabase Postgres — transaction-mode pooler, IPv4)
DATABASE_URL=                      # postgresql://postgres.<project>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres

# Email (Resend) — PLACEHOLDER VALUES SHIPPED, NOT LIVE
RESEND_API_KEY=re_..                       # placeholder — real key must match /^re_[A-Za-z0-9_]{20,}$/
RESEND_FROM_EMAIL=orders@yourdomain.com    # placeholder — must be a verified Resend sender, not yourdomain.com/example.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000   # production: https://yourdomain.com
INITIAL_ADMIN_EMAIL=               # First admin's email address; seeded user row links to this on first sign-in

# Business
BUSINESS_TIMEZONE=America/Chicago
```

> **Actual values** are in `.env.local` (not committed). Check that file directly for
> the live project credentials. The Supabase project reference is `biiqvnqesatnrnawxeki`
> (visible in the dashboard URL) — use this to locate the project in the Supabase console.

**Email is code-complete but inert.** `lib/notifications/emailGuard.ts` no-ops (logs only,
never throws) whenever `RESEND_API_KEY`/`RESEND_FROM_EMAIL` don't look like real values.
Dropping in real credentials activates sending — **no code change needed.**

**Security constraints (must never be broken):**
- Never commit `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-only, never in client code
- `DATABASE_URL` is the Supabase transaction-mode pooler — used by Drizzle; RLS is **not** active on this connection for app reads (see Architecture note below) — **except** for the Realtime-enabling tables added in Phase 6, where RLS is the real boundary (see that section)

---

## Architecture Overview

**Stack:** Next.js 16 (App Router, Node runtime) · Supabase Postgres + Auth + Storage + Realtime ·
Drizzle ORM · Tailwind v4 + `tokens.css` · Radix UI primitives ·
Vitest 4 (unit tests) · Resend (email, inert until real creds) ·
Hosted on Hostinger (GitHub push-deploy, deploy step still a stub).

**Data delivery pattern:**
- React Server Components for page data loads
- Server Actions for all mutations (`"use server"`)
- Small `"use client"` islands for interactive UI only
- Route Handlers only for: printable HTML (`/api/production/[id]/print`), CSV export (`/api/catalog/export`), signed file downloads (`/api/product-files/[id]`, `/api/resources/[id]`)

**RLS architecture note (critical — two different rules now apply):**
Drizzle connects via `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses Postgres RLS entirely**.
All *app-layer* data scoping (company, own-scope, customer_visible, internal-only) is
enforced by explicit `WHERE` clauses in app code; RLS policies for those tables are
defense-in-depth only. **This is still true for every table through Phase 5.**

**Phase 6 changes this for three tables.** Supabase Realtime subscriptions run from the
*browser* using the anon key + the user's own JWT — they go through PostgREST/Realtime's
RLS enforcement, not the service-role connection. So `notifications`, `production_work_orders`,
and `production_line_progress` now carry real `authenticated`-role `SELECT` RLS policies
(see `supabase/migrations/0006_phase6.sql`) that are the *actual* access boundary for what
each browser session receives over Realtime. Keep these in sync with any future scoping
changes to those tables — a Drizzle `WHERE` clause fix alone won't protect Realtime delivery.

**Money:** `numeric(12,2)` in DB. `lib/pricing/money.ts` has `toDecimal`, `addMoney`,
`formatMoney`, `parseMoney`. All totals are computed in JS, rounded, stored as decimals.

---

## Auth Details

### Supabase Auth (email + password, invite-only)

- Login: `/login` — email + password via `@supabase/ssr`
- Invite acceptance: `/invite` — new user sets their password
- Auth callback: `/auth/callback` — handles all 3 Supabase link formats (implicit/hash, OTP token_hash, PKCE code); routes `type=invite`/`recovery` to `/invite`
- No magic-link, no Google SSO. **M365/Entra SSO is a future addition (formally deferred).**
- First admin email comes from `INITIAL_ADMIN_EMAIL` env var (set to `msj1542@gmail.com`)
- **All other users are now created via the UI** (Phase 6): `lib/users/service.ts: createUser()` inserts the `public.users` row, then calls `admin.auth.admin.inviteUserByEmail()` — sending relies on the Supabase project's own email configuration, not Resend. If an invite fails to send, the app-user row is rolled back (no orphan). The existing `on_auth_user_created` trigger (Phase 1) links `auth_user_id` automatically once accepted.

### `lib/auth.ts`

```typescript
getUser(): Promise<AppUser | null>         // returns null if no session or no public.users row
requireUser(): Promise<AppUser>            // redirects to /login if not authenticated
getPreviewContext(): Promise<PreviewContext | null>   // reads portal preview cookie
assertNotPreview(preview): void            // throws in portal preview mode
getEffectiveContext(user)                  // resolves preview overlay for display
```

### Portal Preview Mode ✅ (Phase 1 guard + Phase 6 UI)
An `orderhub_preview` cookie (httpOnly) carries `{ companyId, companyName, roleCode }`. When set,
the app renders what a given company/role would see (read-only). Server Actions
**must** call `assertNotPreview(await getPreviewContext())` at the top — enforced
throughout all existing actions. **Do not add any write Server Action without this guard.**

Entry point (Phase 6): `app/(app)/actions.ts: enterPreviewAction(companyId, companyName, roleCode)`,
triggered from a "Preview as this company" launcher in the company editor
(`components/settings/company-manager.tsx`) — role picker restricted to `EXTERNAL_ROLES`,
gated on `can(user, "portal:preview")`. Exit via the existing `exitPreviewAction`
(`PreviewBanner` shown in the sidebar while active).

### Roles

| Role code | `isInternal` | Description |
|---|---|---|
| `internal_admin` | ✓ | All internal permissions (implicit from `INTERNAL_ADMIN_ACTIONS` set) |
| `order_coordinator` | ✓ | Accept, claim, cancel, release, comment, print labels, manage external users |
| `fulfillment` | ✓ | Claim, QC, piece tally, recuts, print labels. No orders nav. |
| `accounting` | ✓ | Invoice verify, close, comment, production:view |
| `external_admin` | — | Order + manage own company's users (cannot manage/create other `external_admin`s) |
| `external_ordering` | — | Order + request cancel + comment |
| `external_reference` | — | Catalog + resources only (no ordering) |

Dual-role users (e.g., needs both Orders + Production) should use `internal_admin`.

**Nav visibility rule:** `fulfillment` role only sees the Production nav item (not Orders).
Internal admins and coordinators see both.

---

## Permission Model (`lib/authz/policy.ts`)

`can(user, action)` is the single gate. Call it everywhere — never hardcode role strings
in components. `pricing:view` has special handling: internal always true, external
depends on `company.pricingVisible`.

Actions relevant to Phase 6: `resources:manage`, `resources:download`, `companies:manage`,
`users:manage_internal`, `users:manage_external`, `settings:manage`, `portal:preview` — all
pre-existed from Phase 1 (only the UI to exercise them was missing until now).

---

## App Shell

**Route groups (Phase 6 additions marked):**
```
app/
  (auth)/login/page.tsx          # Supabase Auth login form
  (auth)/invite/page.tsx         # Invite acceptance (set password)
  auth/callback/page.tsx         # client component; handles hash/OTP/PKCE
  (app)/layout.tsx               # Shell: sidebar + topbar (RSC, loads session + unread count)
  (app)/dashboard/page.tsx
  (app)/orders/page.tsx          # Orders workspace (RSC list + client filter island)
  (app)/orders/new/page.tsx      # New Order builder (+ reorder_from/supplemental_to prefill)
  (app)/production/page.tsx      # Production queue RSC (+ Realtime live updates)
  (app)/catalog/page.tsx
  (app)/resources/page.tsx                 # NEW — browse, grouped by category
  (app)/notifications/page.tsx             # NEW — list + mark read/all
  (app)/company-users/page.tsx             # NEW (was placeholder) — external team self-service
  (app)/settings/page.tsx                  # NEW — redirects to /settings/companies
  (app)/settings/companies/page.tsx        # NEW — company CRUD + portal preview launcher
  (app)/settings/team/page.tsx             # NEW — internal user manager
  (app)/settings/catalog/page.tsx
  (app)/settings/materials/page.tsx
  (app)/settings/resources/page.tsx        # NEW — resource/category manager
  (app)/settings/operations/page.tsx       # NEW — schedule/rush-fee/timezone settings
  (app)/settings/audit/page.tsx            # NEW — audit log timeline
  api/production/[id]/detail/route.ts
  api/production/[id]/print/route.ts
  api/catalog/export/route.ts
  api/product-files/[id]/route.ts
  api/resources/[id]/route.ts              # NEW — signed resource download
```

`app/(app)/settings/[section]/page.tsx` (the Phase 0 catch-all placeholder) was **deleted**
in Phase 6 — every section it stubbed now has a dedicated page.

Shell features: sidebar nav (role-gated items), topbar with dark mode toggle + sign-out +
**live notification bell** (real unread count from the server, increments via Realtime),
`ThemeToggle` (persists to localStorage, flash-prevention script in `<head>`).

---

## Database — Schema & Migrations

Migrations in `supabase/migrations/`. All applied to production Supabase.

| Migration | Tables added |
|---|---|
| `0001_auth_identity.sql` | `roles`, `companies`, `users` + RLS + role seed |
| `0002_catalog_materials.sql` | `materials`, `material_roll_widths`, `products`, `product_materials`, `prices`, `product_files` + Storage bucket |
| `0003_orders.sql` | `application_settings`, `orders`, `order_lines`, `order_comments`, `order_status_history`, `cancellation_requests`, `audit_log` + `order_number_seq` sequence |
| `0004_production.sql` | `production_work_orders`, `production_line_progress`, `production_recuts`, `qc_attestations` |
| `0005_invoice_verification.sql` | `invoice_verifications` |
| `0006_phase6.sql` | `notifications`, `notification_reads`, `resource_categories`, `resources`, `resource_versions` + `companies` profile columns + `resources` Storage bucket + Realtime-enabling RLS + publication + seed categories |

**Drizzle commands (run from project root):**
```bash
npm run db:generate   # generate migration after schema change
npm run db:migrate    # apply via drizzle-kit (uses DATABASE_URL)
npm run db:studio     # Drizzle Studio
```

For applying raw SQL to production, use the `postgres` npm package (already installed)
with `DATABASE_URL` from `.env.local` — do NOT use `psql` with the password in the
command string (blocked by auto-mode security classifier). See `scripts/run-migration.mjs`
for the established pattern, and `scripts/verify-phase6.mjs` for a template to sanity-check
RLS policies / publication membership / bucket state after a migration.

**Order number sequence:** `public.order_number_seq` — `nextval()` called inside submit
transaction. Format: `OH-{YYYY}-{seq padded to 5}` (e.g., `OH-2026-00001`).

---

## Order Status Machine (`lib/orders/statusMachine.ts`)

| Action | From statuses | To status | Auth action |
|---|---|---|---|
| `submit` | `draft` | `submitted` | `order:submit` |
| `accept` | `submitted` | `accepted` | `order:accept` |
| `claim` | `accepted`, `in_fulfillment` | `in_fulfillment` | `order:claim` |
| `qc` | `in_fulfillment` | `fulfillment_completed` | `order:qc` |
| `invoice_verify` | `fulfillment_completed` | `ready_for_pickup` | `order:invoice_verify` |
| `release` | `ready_for_pickup` | `released` | `order:release` |
| `close` | `released` | `closed` | `order:close` |
| `request_cancel` | `submitted`, `accepted` | *(no change)* | `order:request_cancel` |
| `cancel` | `submitted`, `accepted` | `canceled` | `order:cancel` |
| `decline_cancel` | `submitted`, `accepted` | *(no change)* | `order:decline_cancel` |
| `delete_draft` | `draft` | *(deleted)* | `order:delete_draft` |

`assertCanTransition(action, currentStatus, label?)` throws if the transition is invalid.
Always call it in service functions before any DB write. Two-check pattern: `can(user, authzAction)` first (role gate), then `assertCanTransition()` (state gate).

Every transition function that changes order status now also fires an in-app notification
(and for customer-facing events, a best-effort email) — see the Notifications section below.
Insert the notification **inside** the same `db.transaction` as the state change; send email
**after** the transaction resolves (`.then()`), never inside it.

**Work order status flow** (parallel, per `production_work_orders.status`):
```
pending (created on order:accept)
  → in_progress (order:claim / Begin Production)
  → completed (order:qc / Finalize Production)
  → awaiting_pickup (set when order reaches ready_for_pickup)
  → released (set when order is released)
  → canceled (if order is canceled)
```

---

## Phase 0–4 Summary

### Phase 0 — Foundations ✅
Next.js 16 App Router + TypeScript + Tailwind v4 + `tokens.css` design tokens, Radix UI
primitives, Supabase project provisioned, dark mode toggle, `components/ui/` primitive set.

### Phase 1 — Auth & Identity ✅
Supabase Auth (email+password), login/invite/callback, `roles`/`companies`/`users` + RLS,
`lib/auth.ts`, `lib/authz/policy.ts`, role-based sidebar nav, portal preview server guard.

### Phase 2 — Catalog & Materials ✅
`materials`/`material_roll_widths`/`products`/`product_materials`/`prices`/`product_files`,
catalog browse + admin manager, material settings, CSV import/export, product-files Storage
bucket + signed downloads, `lib/pricing/money.ts`. Seeded 38 products, 76 prices.

### Phase 3 — Ordering Core ✅
`application_settings`/`orders`/`order_lines`/`order_comments`/`order_status_history`/
`cancellation_requests`/`audit_log`, status machine, New Order builder, draft/submit +
duplicate-PO check, orders workspace + detail, comment composer, `lib/settings/schedule.ts`.

### Phase 4 — Production Queue ✅
`production_work_orders`/`production_line_progress`/`production_recuts`/`qc_attestations`,
`lib/production/service.ts`, production queue UI (tabs, piece tally, QC/recut modals),
printable work order + QR labels, `WorkOrderSection` on order detail.

*(Full detail on Phases 0–4 is in the earlier phase completion docs listed above; this
section is intentionally condensed since none of it changed in Phase 5 or 6.)*

---

## Phase 5 — Accounting & Lifecycle ✅

Full detail in [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md). Summary:

- **Invoice verification**: `lib/orders/invoiceVerification.ts` (pure validation) +
  `invoiceVerifyOrder()` — `fulfillment_completed → ready_for_pickup`, WO → `awaiting_pickup`,
  inserts `invoice_verifications` row. UI shows real order lines/totals, one honest attestation,
  discrepancy reason required on mismatch >$0.005.
- **Release / Close**: `releaseOrder()` / `closeOrder()` — same transactional pattern as
  `acceptOrder`/`claimOrder`.
- **Reorder / Supplemental entry points**: buttons on `order-actions.tsx`; `orders/new/page.tsx`
  resolves the source order and rebuilds line items against the *current* catalog.
- **Build-blocking fixes** (pre-existing, not Phase 5 regressions): `lib/production/constants.ts`
  (QC constants moved out of a DB-importing module so a client component could import them
  without pulling the Postgres driver into the browser bundle) and `Button` gained `asChild`
  support. Without both, `npm run build` failed unconditionally in every prior phase.
- **Audit fix applied post-hoc**: `saveOrSubmitOrder()`'s supplemental-parent lookup now runs
  under the requester's own `orderScopeCondition()` (was unscoped, checking only `companyId`
  match) — closes REBUILD_PLAN.md's audit issue #11 for real, found during a Phase 5 audit.
- 101/101 tests passing (was 82).

---

## Phase 6 — Resources, Notifications, Settings ✅

Full detail in [`build_phase_reviews/Phase6_Completion.md`](build_phase_reviews/Phase6_Completion.md). Summary:

- **Notifications**: `lib/notifications/service.ts` (per-user read tracking via
  `notification_reads`, not a boolean column — a broadcast notification is read
  independently by each recipient). Visibility rule (targeted / internal-broadcast /
  company-broadcast) implemented three times by necessity — the Drizzle query condition,
  the RLS policies (the real Realtime boundary), and a pure mirror in
  `lib/notifications/visibility.ts` for unit testing — **keep all three in sync** if the
  rule ever changes. Trigger wiring matches the reference app's 6 notification events
  exactly, inserted inside the same transaction as the state change they announce.
- **Email**: `lib/notifications/email.ts` + `emailGuard.ts` — Resend wrapper, guarded
  no-op until real credentials replace the shipped placeholders. Sends to the order
  creator only, for the 3 customer-facing events; internal-broadcast events are in-app only.
- **Resources**: `lib/resources/service.ts` — categories, versioned documents, pricing-gated
  visibility (`lib/resources/visibility.ts`, shared by the service and the download route).
  Browse page (`/resources`) + admin manager (`/settings/resources`, upload/version via the
  same client-session-upload pattern as the Phase 2 Catalog Manager).
- **Settings hub, fully built out**: Companies (profile/billing fields + portal-preview
  launcher), Internal Users + external Team (shared `UserManager` component;
  `createUser()` inserts the row then sends a Supabase Auth invite, rolling back on failure),
  Operations (rush fee, cutoff/completion schedule, duplicate window, timezone — writes the
  same `application_settings` k/v store `computeExpectedCompletion` reads), Audit History
  (read-only timeline over `audit_log`).
- **Realtime**: production queue and the notification bell both subscribe to Postgres
  Changes. This required writing *real* `authenticated`-role RLS SELECT policies (not just
  `USING (true)`) for `notifications`, `production_work_orders`, `production_line_progress`
  — see the RLS architecture note above. Verified against production Supabase
  (`scripts/verify-phase6.mjs`): all 3 tables in the `supabase_realtime` publication, 17
  RLS policies present, `resources` bucket private.
- **Build fix**: deleted the now-fully-superseded `settings/[section]/page.tsx` catch-all;
  added `settings/page.tsx` redirecting to `/settings/companies`.
- 123/123 tests passing (was 101; +22, covering the notification/resource visibility rules
  and operations-settings validation).

### Known gaps carried forward
- REBUILD_PLAN.md's Resources row mentions "pin a product thumbnail" — already fully
  handled by the Phase 2 Catalog Manager (`product_files.is_thumbnail`); not duplicated here.
  `resources.product_id` exists in the schema (optional association) but isn't yet exposed
  in the Resource Manager UI.
- Browser E2E of every new Phase 5/6 flow was not performed — signing in requires entering
  a password, outside what an agent may do. Both phases were verified via unit tests, clean
  production builds, and (Phase 6) a direct Supabase state check. **Recommend a manual
  click-through before go-live**, especially: Realtime (open the production queue in two
  sessions, confirm live updates), the invite-email flow (confirm Supabase's own email
  actually arrives — depends on the Supabase project's email config, not Resend), and the
  portal-preview launcher end-to-end.

---

## Phase 7 Starting Point

**Tests:** 123/123 passing
**Branch:** `main`

### Phase 7 Objectives (from REBUILD_PLAN.md: "Hardening")
- Vitest suite expansion where still thin (little integration coverage beyond pure-function
  unit tests — intentional so far per the established "no DB, no Supabase, no Next.js in
  tests" pattern; consider whether Phase 7 should add integration coverage)
- Pagination / server-side filter+search on orders, production, catalog, audit, notifications
  (all list views currently load all rows; acceptable at current data volume)
- Orders workspace scope tabs ("Needs My Action" for internal coordinators) — search + status
  filter exist, scope tabs don't
- Production queue text search (tab + status filtering only today)
- CSV import field-level diff (preview shows counts, not before/after values)
- Empty/onboarding states, a11y pass, perf pass
- Deploy runbook — **Hostinger deploy step is still a stub**; `serverActions.allowedOrigins`
  needs the production domain added to `next.config` before go-live

### Phase 7 Non-Goals (per REBUILD_PLAN.md, still post-MVP / no committed phase)
- Reminder/escalation scheduler (pg_cron) — recipients/thresholds undefined
- M365/Entra ID SSO — email+password ships

---

## Service Layer Quick-Reference

### `lib/orders/service.ts`
| Function | What it does |
|---|---|
| `listOrders(user, filters)` | Scoped list (company/own based on role + scope) |
| `getOrder(id, user)` | Full order + lines + comments + cancel req + work order brief |
| `saveOrSubmitOrder(user, input, mode)` | Create/update draft or submit; fires `order_submitted_*` notifications + email on submit |
| `deleteDraft(orderId, user)` | Soft-delete draft (audit log survives) |
| `addComment(orderId, user, body, isInternal)` | Comment thread append |
| `acceptOrder(orderId, user, expectedCompletionDate?)` | `submitted → accepted` + creates WO + `order_accepted` notification/email |
| `claimOrder(orderId, user)` | `accepted → in_fulfillment` + WO `pending → in_progress` |
| `requestCancellation(orderId, user, reason)` | Sets cancel flag, inserts `cancellation_requests` row + `cancellation_requested` notification |
| `cancelOrder(orderId, user, reason)` | `submitted/accepted → canceled`, resolves cancel req |
| `declineCancellation(orderId, user, reason?)` | Clears cancel flag, resolves cancel req |
| `getDashboardCounts(user)` | Stat card counts for dashboard |
| `invoiceVerifyOrder(orderId, input, user)` | `fulfillment_completed → ready_for_pickup`, WO → `awaiting_pickup`, `ready_for_pickup` notification/email |
| `releaseOrder(orderId, user)` | `ready_for_pickup → released`, WO → `released` |
| `closeOrder(orderId, user)` | `released → closed` |

### `lib/notifications/service.ts`
| Function | What it does |
|---|---|
| `insertNotification(tx, input)` | Insert inside the caller's own transaction |
| `listNotifications(user, opts?)` | Scoped list with per-user `isRead` flag |
| `getUnreadCount(user)` | For topbar badge + dashboard |
| `markNotificationRead(id, user)` / `markAllNotificationsRead(user)` | Per-user read tracking |
| `getOrderCreatorEmail(userId)` | Email recipient resolution for order-lifecycle mail |

### `lib/notifications/email.ts` / `emailGuard.ts`
| Function | What it does |
|---|---|
| `sendEmail({to, subject, html})` | Resend wrapper; no-ops + logs if unconfigured; never throws |
| `isResendConfigured(key, from)` | Pure heuristic guard — must match `/^re_[A-Za-z0-9_]{20,}$/` and a plausible non-placeholder from-address |

### `lib/resources/service.ts` / `visibility.ts`
| Function | What it does |
|---|---|
| `listCategories()` / `createCategory()` / `updateCategory()` | Category CRUD |
| `listResources(user, filters?)` / `getResource(id, user)` | Scoped listing/detail |
| `createResource(data)` / `updateResource(id, data)` | Resource CRUD |
| `addResourceVersion(resourceId, data, uploadedBy)` | New version → becomes `current_version_id` |
| `canExternalUserSeeResource(resource, viewer)` | Pure visibility rule, shared by service + download route |

### `lib/companies/service.ts`
`listCompanies()`, `getCompany(id)`, `createCompany(data)`, `updateCompany(id, data)`.

### `lib/users/service.ts`
| Function | What it does |
|---|---|
| `listInternalUsers()` / `listCompanyUsers(companyId)` | Scoped listing |
| `createUser(input)` | Insert row + send Supabase Auth invite; rolls back row on invite failure |
| `updateUser(id, data, actingUser)` | Internal-admin path — self-deactivation guard only |
| `updateCompanyUser(id, data, actingUser)` | Company-admin path — **also enforces target is in the acting admin's company and is not an `external_admin`** |

### `lib/settings/service.ts` / `validate.ts`
`updateOperationsSettings(input, modifiedBy)` writes the same `application_settings` k/v
store `getSettings()` (in `lib/settings/schedule.ts`) reads. `validateOperationsSettings(input)`
is the pure validation function (weekday/time/rush-fee-mode/duplicate-window checks).

### `lib/audit/service.ts`
`listAuditLog(opts?)` — most recent 200 entries (or filtered by `orderId`), joined to
user/order names.

### `lib/production/service.ts`
| Function | What it does |
|---|---|
| `listWorkOrders(user, tab)` | Scoped list by tab (current/completed/archived/all) |
| `getWorkOrder(id, user)` | Full WO with lines, progress, recuts |
| `claimWorkOrder(workOrderId, user)` | Delegates to `claimOrder()` via orderId lookup |
| `updatePieceProgress(woId, lineId, pieces[], user)` | Check-then-upsert piece tally |
| `recordRecut(woId, lineId, qty, reason, user)` | Validates + inserts recut row |
| `submitQC(woId, answers, notes, user)` | Validates all 3 QC keys, inserts attestation, transitions WO + order, fires `fulfillment_completed` notification |

### `lib/catalog/service.ts`
Full CRUD for products, materials, prices, files. See file for function signatures.

### `lib/settings/schedule.ts`
- `getSettings()` — reads `application_settings` with env fallbacks
- `computeExpectedCompletion(settings, now)` — cutoff-week algorithm
- `computeRushFee(subtotal, settings)` — flat/percentage/disabled

---

## Server Action Pattern (Required for Every Write Action)

```typescript
"use server";
import { requireUser } from "@/lib/auth";
import { getPreviewContext, assertNotPreview } from "@/lib/auth";

export async function myAction(/* params */) {
  const [user, preview] = await Promise.all([requireUser(), getPreviewContext()]);
  assertNotPreview(preview);  // ← required; throws in portal preview mode
  // ... service call
}
```

Every action file in the app follows this pattern, including all Phase 6 additions
(`notifications/actions.ts`, `settings/companies/actions.ts`, `settings/team/actions.ts`,
`company-users/actions.ts`, `settings/resources/actions.ts`, `settings/operations/actions.ts`).
Any new action must do the same.

---

## Test Infrastructure

**Runner:** Vitest 4 (`npm test`)
**Location:** `lib/**/*.test.ts` (alongside source files)
**Current result:** 123/123 pass

Tests are pure unit tests — no DB connection, no Supabase, no Next.js. Service functions
that need DB mocking are tested via extracted pure functions (validation rules, visibility
predicates, calculation logic). Keep this pattern. **Run before every commit.**

| Area | Test file(s) |
|---|---|
| Authz | `lib/authz/policy.test.ts` |
| Order status machine | `lib/orders/statusMachine.test.ts` |
| Duplicate PO | `lib/orders/duplicate.test.ts` |
| Invoice verification | `lib/orders/invoiceVerification.test.ts` |
| Schedule/rush fee | `lib/settings/schedule.test.ts` |
| Production/QC | `lib/production/service.test.ts` |
| Notification email guard | `lib/notifications/emailGuard.test.ts` |
| Notification visibility | `lib/notifications/visibility.test.ts` |
| Resource visibility | `lib/resources/visibility.test.ts` |
| Operations settings validation | `lib/settings/validate.test.ts` |

---

## Design System Quick-Reference

**Design token source:** `app/tokens.css` (CSS custom properties, light + dark)
**Tailwind v4** used for base layer only; almost all visual styling uses `var(--token-name)` directly.

Key token namespaces (use these, never invent one-off hex colors):
- `--color-brand`, `--color-brand-hover`, `--color-brand-fg`
- `--color-panel`, `--color-canvas`, `--color-sunken`, `--color-raised`
- `--color-border-subtle`, `--color-border-default`, `--color-border-strong`
- `--color-text-primary`, `--color-text-muted`, `--color-text-inverse`
- `--status-{family}-bg`, `--status-{family}-border`, `--status-{family}-text`
  - Families: `neutral`, `info`, `success`, `warning`, `danger`, `urgent`, `completed`
- `--space-{1|2|3|4|5|6|8|10|12}` (4px base scale)
- `--text-{xs|sm|base|md|lg|xl|2xl}`, `--weight-{regular|medium|semibold|bold}`
- `--radius-{sm|md|lg|pill}`

`StatusPill` (`components/ui/status-pill.tsx`) is the single source for colored status badges.
`ORDER_STATUS_FAMILY` maps order statuses to StatusFamily values. For work order statuses,
use the inline mapping in `components/orders/work-order-section.tsx` as the reference.
`Button` supports `asChild` (Radix `Slot`) since Phase 5 for wrapping a `<Link>`.
