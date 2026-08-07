# OrderHub — Handoff: Phase 6 (locked) → Phase 7

> **Purpose.** This document gives a new conversation everything needed to resume
> work from after Phase 6 (complete, audited, and locked) into Phase 7 with no loss
> of context. It supersedes `HANDOFF_Phase0-6.md` as the current handoff doc — that
> file is still present as a Phase-6-completion-time snapshot, but this one reflects
> the state after the Phase 6 audit and its two follow-up fixes.
> Created: 2026-08-06.

---

## Key Reference Documents

| Document | What it contains |
|---|---|
| [`REBUILD_PLAN.md`](REBUILD_PLAN.md) | Full architecture decisions, build order, phase-by-phase checklist, UX improvements. **Read this first** — it is the source-of-truth spec for the whole rebuild. |
| [`CLAUDE.md`](CLAUDE.md) | Codebase instructions, reference app location, rebuild rules (visual/behavioral fidelity to `original-reference/`, never edit it), inference-flagging rule. |
| `build_phase_reviews/` (all files) | Every phase's completion + audit record. Listed individually below, oldest first. |
| [`build_phase_reviews/Phase2_Completion.md`](build_phase_reviews/Phase2_Completion.md), [`Phase2_Audit_1.md`](build_phase_reviews/Phase2_Audit_1.md), [`Phase2_Audit_2.md`](build_phase_reviews/Phase2_Audit_2.md) | Catalog & materials |
| [`build_phase_reviews/Phase3_Completion.md`](build_phase_reviews/Phase3_Completion.md), [`Phase3_Audit_1.md`](build_phase_reviews/Phase3_Audit_1.md), [`Phase3_Audit_2.md`](build_phase_reviews/Phase3_Audit_2.md) | Ordering core |
| [`build_phase_reviews/Phase4_Completion.md`](build_phase_reviews/Phase4_Completion.md), [`Phase4_Audit_1.md`](build_phase_reviews/Phase4_Audit_1.md), [`Phase4_Audit_2.md`](build_phase_reviews/Phase4_Audit_2.md) | Production queue |
| [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md), [`Phase5_Audit_1.md`](build_phase_reviews/Phase5_Audit_1.md) | Accounting & lifecycle (invoice verify, release/close, reorder/supplemental) |
| [`build_phase_reviews/Phase6_Completion.md`](build_phase_reviews/Phase6_Completion.md), [`Phase6_Audit_1.md`](build_phase_reviews/Phase6_Audit_1.md) | Resources, notifications, settings hub, Realtime |
| [`build_phase_reviews/pre-final-phase_verification.md`](build_phase_reviews/pre-final-phase_verification.md) | Comprehensive 13-section re-verification of every checklist item through Phase 6, done directly against production Supabase. **This is the most current and most thorough state check** — read it before assuming anything about what's built/working. |
| [`HANDOFF_Phase0-6.md`](HANDOFF_Phase0-6.md) | Prior cumulative handoff, current as of Phase 6 completion (before the audit + 2 follow-up fixes below). Superseded by this document; kept for history. |
| `original-reference/` | **READ-ONLY.** Reference app at `C:\Users\mjager\Documents\Codex\2026-07-29\...\work\site`. Source of truth for behavior, copy, visuals. **Never edit anything under it.** |

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

That is the **complete set of env vars currently in use** — nothing else is read by the
app anywhere in `lib/`, `app/`, or `scripts/` (confirmed by grep during the pre-final
verification).

> **Actual values** are in `.env.local` (not committed — verify this with `git status`
> before any commit that touches it). Check that file directly for the live project
> credentials. The Supabase project reference is `biiqvnqesatnrnawxeki` (visible in the
> dashboard URL) — use this to locate the project in the Supabase console.

**Email is code-complete but inert.** `lib/notifications/emailGuard.ts` no-ops (logs only,
never throws) whenever `RESEND_API_KEY`/`RESEND_FROM_EMAIL` don't look like real values
(the check: key must match `/^re_[A-Za-z0-9_]{20,}$/`, from-address must be a plausible
email not on a placeholder domain like `yourdomain.com`/`example.com`). Dropping in real
credentials activates sending — **no code change needed.**

**Security constraints (must never be broken):**
- Never commit `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-only, never in client code
- `DATABASE_URL` is the Supabase transaction-mode pooler — used by Drizzle; RLS is **not** active on this connection for app reads (see Architecture note below) — **except** for the 3 Realtime-enabled tables, where RLS is the real access boundary

---

## Architecture Overview

**Stack:** Next.js 16 (App Router, Node runtime) · Supabase Postgres + Auth + Storage + Realtime ·
Drizzle ORM · Tailwind v4 + `tokens.css` · Radix UI primitives ·
Vitest 4 (unit tests) · Resend (email, inert until real creds) ·
Hosted on Hostinger (GitHub push-deploy, deploy step still a stub — see Phase 7 objectives).

**Data delivery pattern:**
- React Server Components for page data loads
- Server Actions for all mutations (`"use server"`)
- Small `"use client"` islands for interactive UI only
- Route Handlers only for: printable HTML (`/api/production/[id]/print`), CSV export (`/api/catalog/export`), signed file downloads (`/api/product-files/[id]`, `/api/resources/[id]`)

**RLS architecture note (critical — two different rules apply, and there's a known gap):**

Drizzle connects via `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses Postgres RLS entirely**.
All *app-layer* data scoping (company, own-scope, customer_visible, internal-only) is
enforced by explicit `WHERE` clauses in app code (`lib/orders/service.ts`'s
`orderScopeCondition()` is the canonical example); RLS policies for those tables are
defense-in-depth only, **with one documented exception** described next.

**Realtime subscriptions run from the browser** using the anon key + the user's own JWT —
they go through PostgREST/Realtime's RLS enforcement, not the service-role connection. So
`notifications`, `production_work_orders`, and `production_line_progress` carry real
`authenticated`-role `SELECT` RLS policies (see `supabase/migrations/0006_phase6.sql`)
that are the *actual* access boundary for what each browser session receives over
Realtime. All 3 tables were re-verified directly against production during the pre-final
audit: present in the `supabase_realtime` publication, `REPLICA IDENTITY FULL` set, and
correctly scoped RLS in place.

**Fixed in Phase 7:** the `orders`/`order_lines`/`order_comments` RLS `_select_external`
policies (written in Phase 3) used to implement company-only scoping, looser than the app
layer's `orderScopeCondition()`. `supabase/migrations/0007_orders_rls_own_scope.sql` (a new
migration, applied to production) added a `current_order_scope()` helper function and
redefined all 3 policies to mirror `orderScopeCondition()` exactly — company match, plus a
`created_by_user_id` match whenever `companies.order_scope = 'own'`. Verified directly
against production by reading back `pg_policies.qual` for all 3 policies. `0003_orders.sql`
keeps its original policy definitions for historical accuracy (a fresh migration run
applies 0003 first, then 0007 supersedes it) with updated comments pointing to 0007.

**Money:** `numeric(12,2)` in DB. `lib/pricing/money.ts` has `toDecimal`, `addMoney`,
`formatMoney`, `parseMoney`. All totals are computed in JS, rounded, stored as decimals.
Confirmed via grep (pre-final audit) that every price-touching file uses this util — no
raw float arithmetic on money anywhere else in the codebase.

---

## Auth Details

### Supabase Auth (email + password, invite-only)

- Login: `/login` — email + password via `@supabase/ssr`
- Invite acceptance: `/invite` — new user sets their password
- Auth callback: `/auth/callback` — handles all 3 Supabase link formats (implicit/hash, OTP token_hash, PKCE code); routes `type=invite`/`recovery` to `/invite`
- No magic-link, no Google SSO. **M365/Entra SSO is a future addition (formally deferred, post-MVP, no committed phase).**
- First admin email comes from `INITIAL_ADMIN_EMAIL` env var (set to `msj1542@gmail.com`)
- **All other users are created via the UI** (Phase 6): `lib/users/service.ts: createUser()` inserts the `public.users` row, then calls `admin.auth.admin.inviteUserByEmail()` — actual delivery relies on the Supabase project's own email configuration, **not** Resend (Resend is only for order-lifecycle notifications). If an invite fails to send, the app-user row is rolled back (no orphan). The existing `on_auth_user_created` trigger (Phase 1) links `auth_user_id` automatically once accepted.
- **Not yet verified end-to-end**: whether Supabase's invite email actually arrives depends on that project's email config, which this agent cannot check from the codebase. The pre-final audit confirmed a second `internal_admin` row (`michael@glasstintusa.com`) exists in production with a linked `auth_user_id`, which is *consistent with* the invite flow having been used successfully at least once, but this was not directly confirmed via an actual email receipt.

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
triggered from a "Preview as this company" launcher **embedded directly in the company
editor panel** (`components/settings/company-manager.tsx`) — role picker restricted to
`EXTERNAL_ROLES`, gated on `can(user, "portal:preview")`. Exit via the existing
`exitPreviewAction` (`PreviewBanner` shown in the sidebar while active). Note: this is an
inline launcher, not a modal dialog — REBUILD_PLAN.md's checklist literally said "modal";
functionally complete either way, flagged in `Phase6_Audit_1.md` as a cosmetic deviation.

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
Internal admins and coordinators see both. All 7 roles' nav visibility was re-reasoned
through `can()` during the pre-final audit — no role sees a nav item it lacks permission for.

---

## Permission Model (`lib/authz/policy.ts`)

`can(user, action)` is the single gate. Call it everywhere — never hardcode role strings
in components. `pricing:view` has special handling: internal always true, external
depends on `company.pricingVisible`.

**Exactly 28 actions** are defined (counted directly during the pre-final audit):
`catalog:manage`, `catalog:view`, `companies:manage`, `materials:manage`, `order:accept`,
`order:cancel`, `order:claim`, `order:close`, `order:comment_customer`,
`order:comment_internal`, `order:create`, `order:decline_cancel`, `order:delete_draft`,
`order:invoice_verify`, `order:print_labels`, `order:qc`, `order:release`,
`order:request_cancel`, `order:submit`, `portal:preview`, `pricing:view`,
`production:manage`, `production:view`, `resources:download`, `resources:manage`,
`settings:manage`, `users:manage_external`, `users:manage_internal`. `lib/authz/policy.test.ts`
(23 tests) covers the key role/action boundaries and the `pricing:view` special case — not
an exhaustive 28×7 matrix, consistent with the project's "test the rule, not every cell" pattern.

---

## App Shell

**Route groups:**
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
  (app)/resources/page.tsx                 # browse, grouped by category
  (app)/notifications/page.tsx             # list + mark read/all
  (app)/company-users/page.tsx             # external team self-service
  (app)/settings/page.tsx                  # redirects to /settings/companies
  (app)/settings/companies/page.tsx        # company CRUD + portal preview launcher
  (app)/settings/team/page.tsx             # internal user manager
  (app)/settings/catalog/page.tsx
  (app)/settings/materials/page.tsx
  (app)/settings/resources/page.tsx        # resource/category manager
  (app)/settings/operations/page.tsx       # schedule/rush-fee/timezone settings
  (app)/settings/audit/page.tsx            # audit log timeline
  api/production/[id]/detail/route.ts
  api/production/[id]/print/route.ts
  api/catalog/export/route.ts
  api/product-files/[id]/route.ts
  api/resources/[id]/route.ts              # signed resource download
```

`app/(app)/settings/[section]/page.tsx` (the Phase 0 catch-all placeholder) was **deleted**
in Phase 6 — every section it stubbed now has a dedicated page.

Shell features: sidebar nav (role-gated items, verified for all 7 roles), topbar with dark
mode toggle + sign-out + **live notification bell** (real unread count from the server,
increments via Realtime), `ThemeToggle` (persists to `localStorage`, flash-prevention
script in `<head>`, confirmed working via direct code read this audit round).

---

## Database — Schema & Migrations

Migrations in `supabase/migrations/`. All applied to production Supabase (re-verified this
audit round via `scripts/verify-full.mjs` — every one of 26 public tables has RLS enabled
with ≥1 policy; seed counts, storage buckets, and Realtime prerequisites all confirmed live).

| Migration | Tables added | Notes |
|---|---|---|
| `0001_auth_identity.sql` | `roles`, `companies`, `users` + RLS + role seed | |
| `0002_catalog_materials.sql` | `materials`, `material_roll_widths`, `products`, `product_materials`, `prices`, `product_files` + Storage bucket | |
| `0003_orders.sql` | `application_settings`, `orders`, `order_lines`, `order_comments`, `order_status_history`, `cancellation_requests`, `audit_log` + `order_number_seq` sequence | **Updated post-Phase-6** with `NOTE:` comments on the 3 external-select policies documenting the company-only-vs-own-scope RLS gap (see Architecture note above). Comment-only change, no schema/policy change, no re-migration was needed. |
| `0004_production.sql` | `production_work_orders`, `production_line_progress`, `production_recuts`, `qc_attestations` | |
| `0005_invoice_verification.sql` | `invoice_verifications` | |
| `0006_phase6.sql` | `notifications`, `notification_reads`, `resource_categories`, `resources`, `resource_versions` + `companies` profile columns + `resources` Storage bucket + Realtime-enabling RLS + publication + seed categories | |
| `0007_orders_rls_own_scope.sql` | No new tables. Adds `current_order_scope()` helper + redefines the 3 `orders`/`order_lines`/`order_comments` external-select RLS policies to mirror `orderScopeCondition()` exactly (own-scope fix, Phase 7). |

**Drizzle commands (run from project root):**
```bash
npm run db:generate   # generate migration after schema change
npm run db:migrate    # apply via drizzle-kit (uses DATABASE_URL)
npm run db:studio     # Drizzle Studio
```

For applying raw SQL to production, use the `postgres` npm package (already installed)
with `DATABASE_URL` from `.env.local` — do NOT use `psql` with the password in the
command string (blocked by auto-mode security classifier). Established scripts:
- `scripts/run-migration.mjs <path>` — applies a migration file
- `scripts/verify-phase6.mjs` — Phase-6-specific check (publication membership, RLS policy count, bucket state)
- `scripts/verify-full.mjs` — **broader** check added during the pre-final audit: RLS enabled/policy-count for every public table, every `authenticated`-role policy listed, seed data counts, storage bucket list. Prefer this one for future full-state checks.

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
Always call it in service functions before any DB write. Two-check pattern: `can(user, authzAction)` first (role gate), then `assertCanTransition()` (state gate). All 11 transitions
re-verified this audit round (34 tests in `statusMachine.test.ts`).

Every transition function that changes order status also fires an in-app notification
(and for customer-facing events, a best-effort email) — see the Notifications section below.
Insert the notification **inside** the same `db.transaction` as the state change; send email
**after** the transaction resolves (`.then()`), never inside it. Confirmed by direct read
this audit round: all 8 status-changing service functions (`acceptOrder`, `claimOrder`,
`cancelOrder`, `declineCancellation`, `invoiceVerifyOrder`, `releaseOrder`, `closeOrder`,
`submitQC`) insert both `order_status_history` and `audit_log` inside the same transaction
as the state change.

**Work order status flow** (parallel, per `production_work_orders.status`):
```
pending (created on order:accept)
  → in_progress (order:claim / Begin Production)
  → completed (order:qc / Finalize Production)
  → awaiting_pickup (set when order reaches ready_for_pickup)
  → released (set when order is released)
  → canceled (if order is canceled)
```

**Label reprint** (`components/production/production-queue.tsx`, "Print Labels" button
condition): available for `pending`, `in_progress`, `completed`, `awaiting_pickup`, **and
now `released`** (fixed post-Phase-6 — previously unavailable once a WO shipped).

---

## Phase 0–4 Summary (condensed — unchanged since Phase 4)

### Phase 0 — Foundations ✅
Next.js 16 App Router + TypeScript + Tailwind v4 + `tokens.css` design tokens, Radix UI
primitives, Supabase project provisioned, dark mode toggle (confirmed still present and
working — `components/ui/theme-toggle.tsx`), `components/ui/` primitive set (Button, Tabs,
Dialog, DataTable, ConfirmDialog, MasterDetail, Toaster, etc. — all confirmed to have
active call sites this audit round).

### Phase 1 — Auth & Identity ✅
Supabase Auth (email+password), login/invite/callback, `roles`/`companies`/`users` + RLS,
`lib/auth.ts`, `lib/authz/policy.ts`, role-based sidebar nav, portal preview server guard.

### Phase 2 — Catalog & Materials ✅
`materials`/`material_roll_widths`/`products`/`product_materials`/`prices`/`product_files`,
catalog browse + admin manager, material settings (confirmed still present —
`app/(app)/settings/materials/page.tsx` + `components/catalog/material-settings.tsx`),
CSV import/export (confirmed still present, unchanged), product-files Storage bucket +
signed downloads, `lib/pricing/money.ts`. Seed confirmed live in production: 38 products,
76 prices, 2 materials (Gloss/Matte).

### Phase 3 — Ordering Core ✅
`application_settings`/`orders`/`order_lines`/`order_comments`/`order_status_history`/
`cancellation_requests`/`audit_log`, status machine, New Order builder, draft/submit +
duplicate-PO check (confirmed: exactly one code path sets `status='submitted'`, and it's
gated by the dupe check every time), orders workspace + detail, comment composer,
`lib/settings/schedule.ts`.

### Phase 4 — Production Queue ✅
`production_work_orders`/`production_line_progress`/`production_recuts`/`qc_attestations`,
`lib/production/service.ts`, production queue UI (tabs, piece tally, QC/recut modals),
printable work order + QR labels, `WorkOrderSection` on order detail. Label reprint gap
(released WOs) fixed post-Phase-6 — see Order Status Machine section above.

*(Full detail on Phases 0–4 is in the earlier phase completion docs listed at the top.)*

---

## Phase 5 — Accounting & Lifecycle ✅

Full detail in [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md) + [`Phase5_Audit_1.md`](build_phase_reviews/Phase5_Audit_1.md). Summary:

- **Invoice verification**: `lib/orders/invoiceVerification.ts` (pure validation) +
  `invoiceVerifyOrder()` — `fulfillment_completed → ready_for_pickup`, WO → `awaiting_pickup`,
  inserts `invoice_verifications` row. UI shows real order lines/totals, one honest attestation,
  discrepancy reason required on mismatch >$0.005.
- **Release / Close**: `releaseOrder()` / `closeOrder()` — same transactional pattern as
  `acceptOrder`/`claimOrder`. Both confirmed transactional this audit round.
- **Reorder / Supplemental entry points**: buttons on `order-actions.tsx`; `orders/new/page.tsx`
  resolves the source order and rebuilds line items against the *current* catalog.
- **Build-blocking fixes** (pre-existing, not Phase 5 regressions): `lib/production/constants.ts`
  (QC constants moved out of a DB-importing module so a client component could import them
  without pulling the Postgres driver into the browser bundle) and `Button` gained `asChild`
  support. Without both, `npm run build` failed unconditionally in every prior phase.
- **Audit fix applied post-hoc**: `saveOrSubmitOrder()`'s supplemental-parent lookup now runs
  under the requester's own `orderScopeCondition()` (was unscoped, checking only `companyId`
  match) — closes REBUILD_PLAN.md's audit issue #11 for real, found during the Phase 5 audit.
- Cancellation decline confirmed fully wired (action, button, status transition) during the
  Phase 5 audit — was built in Phase 3, not a Phase 5 addition, just re-confirmed.

---

## Phase 6 — Resources, Notifications, Settings ✅ (locked)

Full detail in [`build_phase_reviews/Phase6_Completion.md`](build_phase_reviews/Phase6_Completion.md), [`Phase6_Audit_1.md`](build_phase_reviews/Phase6_Audit_1.md), and [`pre-final-phase_verification.md`](build_phase_reviews/pre-final-phase_verification.md). Summary:

- **Notifications**: `lib/notifications/service.ts` (per-user read tracking via
  `notification_reads`, not a boolean column — a broadcast notification is read
  independently by each recipient). Visibility rule (targeted / internal-broadcast /
  company-broadcast) exists in **three** implementations by necessity — the pure TS
  function (`lib/notifications/visibility.ts`), the Drizzle query condition
  (`lib/notifications/service.ts`), and the RLS policies (`0006_phase6.sql`, the real
  Realtime boundary). **All three were walked branch-by-branch and confirmed to match**
  during the pre-final audit, including the NULL-vs-NULL SQL edge case. Keep all three in
  sync if this rule ever changes — only the pure function has automated test coverage.
  Trigger wiring matches the reference app's 6 notification events exactly, inserted
  inside the same transaction as the state change they announce.
- **Email**: `lib/notifications/email.ts` + `emailGuard.ts` — Resend wrapper, guarded
  no-op until real credentials replace the shipped placeholders (confirmed via test using
  the literal placeholder values). Of the 6 notification triggers, only the 3
  customer-facing ones (order submitted, accepted, ready-for-pickup) additionally attempt
  email, sent to the order creator only; internal-broadcast events are in-app only —
  matches the reference app's behavior.
- **Resources**: `lib/resources/service.ts` — categories, versioned documents,
  pricing-gated visibility. `lib/resources/visibility.ts`'s `canExternalUserSeeResource()`
  is called **directly** (not re-implemented) by `listResources()`, `getResource()`, and
  the `/api/resources/[id]` download route — three of four verification points share one
  function, which is stronger consistency than the notification rule can achieve. Only the
  RLS policy is a necessarily-separate SQL copy, and it matches. Browse page (`/resources`)
  + admin manager (`/settings/resources`, upload/version via the same client-session-upload
  pattern as the Phase 2 Catalog Manager).
- **Settings hub, fully built out**: Companies (profile/billing fields + portal-preview
  launcher — inline panel, not a modal, see Auth Details), Internal Users + external Team
  (shared `UserManager` component; `createUser()` inserts the row then sends a Supabase
  Auth invite, rolling back on failure), Operations (rush fee, cutoff/completion schedule,
  duplicate window, timezone — writes the same `application_settings` k/v store
  `computeExpectedCompletion` reads), Audit History (read-only timeline over `audit_log`,
  200-entry cap).
- **Realtime**: production queue and the notification bell both subscribe to Postgres
  Changes. Required writing real `authenticated`-role RLS `SELECT` policies (not
  `USING (true)`) for `notifications`, `production_work_orders`, `production_line_progress`.
  **All prerequisites independently re-verified against production this audit round** (not
  just re-read from the migration file): publication membership confirmed via
  `pg_publication_tables`, `REPLICA IDENTITY FULL` confirmed via `pg_class.relreplident`
  (all 3 report `'f'`), 17 RLS policies confirmed present.
- **Build fix**: deleted the now-fully-superseded `settings/[section]/page.tsx` catch-all;
  added `settings/page.tsx` redirecting to `/settings/companies`.
- 123/123 tests passing.

### Post-Phase-6 fixes (this session, before Phase 7 starts)
1. **RLS documentation note** — `supabase/migrations/0003_orders.sql`: added an explicit
   `NOTE:` comment above the 3 external-select policies on `orders`/`order_lines`/
   `order_comments` documenting the company-only-vs-own-scope gap (see Architecture note
   above). Comment-only, no schema/behavior change, no re-migration needed.
2. **Label reprint for released work orders** — `components/production/production-queue.tsx`:
   the "Print Labels" button condition now includes `released` (previously stopped at
   `awaiting_pickup`). Same one-line-fix pattern as the original Phase 4 audit fix.

Both fixes committed as `rebuild: Phase 7 prep (RLS doc note + label reprint for released WOs)`.
123/123 tests still passing after both.

### Known gaps carried forward (all non-blocking)
- `resources.product_id` exists in the schema (optional association, mirrors the reference
  app) but isn't exposed in the Resource Manager UI. Intentional — product thumbnails are
  already fully handled by the Phase 2 Catalog Manager (`product_files.is_thumbnail`);
  duplicating that here would be redundant.
- Portal preview is an inline launcher, not a modal dialog (see Auth Details above).
- Browser E2E of the full Phase 5/6 flow set (invoice verify → release → close, reorder,
  supplemental, notifications, resource upload/download, company/user CRUD, operations
  settings, portal preview, Realtime) has **never been performed** across any of these
  phases — signing in requires entering a password, which is outside what this agent may
  do. Every phase was instead verified via unit tests, clean production builds, and direct
  Supabase state checks. **Recommend a manual click-through before go-live**, especially:
  Realtime (open the production queue in two browser sessions, confirm live updates), the
  invite-email flow (confirm Supabase's own email actually arrives — depends on that
  project's email config, not Resend, and has never been directly confirmed), and the
  portal-preview launcher end-to-end.

---

## Phase 7 Starting Point

**Tests:** 123/123 passing
**Branch:** `main`, pushed through commit `deb5050` (Phase 7 prep fixes)
**Status:** Phase 6 is locked per the pre-final verification — all 13 checked sections
pass, with the two findings above now addressed (1 documented, 1 fixed).

### Phase 7 Objectives (from REBUILD_PLAN.md: "Hardening")
- Vitest suite expansion where still thin — coverage today is pure-function unit tests
  only (no DB/Supabase/Next.js integration tests), intentional so far; consider whether
  Phase 7 should add integration coverage, especially given the RLS/scoping subtleties
  documented above that unit tests alone can't catch
- Pagination / server-side filter+search on orders, production, catalog, audit,
  notifications (all list views currently load all rows — acceptable at current data
  volume, but worth checking against expected production scale before go-live)
- Orders workspace scope tabs ("Needs My Action" for internal coordinators) — search +
  status filter exist, scope tabs don't
- Production queue text search (tab + status filtering only today)
- CSV import field-level diff (preview shows counts, not before/after values)
- Empty/onboarding states, a11y pass, perf pass
- Deploy runbook — **Hostinger deploy step is still a stub**; `serverActions.allowedOrigins`
  needs the production domain added to `next.config` before go-live
- Consider the manual browser click-through recommended above (not technically a
  REBUILD_PLAN.md checklist item, but a real verification gap across every phase since 4)
- Optional: fix the RLS own-scope gap on `orders`/`order_lines`/`order_comments` proactively
  rather than waiting for a future phase that needs Realtime/PostgREST on those tables

## Deploy wiring (Hostinger) — setup steps for the account owner

The code side is prepped (`.github/workflows/deploy.yml`'s Hostinger step, previously an
`echo "TODO"` stub, now SSHes in and runs `git reset --hard` + `npm ci` + `npm run build` +
a restart command). This can't be finished or tested by an agent — it needs an actual
Hostinger account, SSH key, and domain decision. Steps:

1. **Provision hosting.** In Hostinger's hPanel, create a Node.js application (or a VPS —
   either works with this deploy step) pointed at wherever you'll clone this repo on the
   server. Node 20+ to match `actions/setup-node` in the workflow.
2. **Clone the repo on the server** (one-time): `git clone <this-repo-url> <app-dir>`, then
   create `.env.local` in `<app-dir>` with the **production** values for every var listed
   in this doc's "Environment Variables" section above (production Supabase URL/keys,
   production `DATABASE_URL`, real `RESEND_API_KEY`/`RESEND_FROM_EMAIL` if email should go
   live, `NEXT_PUBLIC_APP_URL` set to the production domain, `INITIAL_ADMIN_EMAIL`).
   `.env.local` is gitignored, so it survives every future `git reset --hard` deploy.
3. **Generate a deploy SSH key pair** (don't reuse your personal key):
   `ssh-keygen -t ed25519 -C "orderhub-deploy" -f orderhub_deploy_key -N ""`
   Add the **public** key (`orderhub_deploy_key.pub`) to the server's
   `~/.ssh/authorized_keys` for the deploy user (via hPanel's SSH key manager or by hand).
4. **Add 5 GitHub Actions secrets** (repo → Settings → Secrets and variables → Actions):
   | Secret | Value |
   |---|---|
   | `HOSTINGER_HOST` | server hostname or IP from hPanel |
   | `HOSTINGER_USERNAME` | SSH username from hPanel |
   | `HOSTINGER_SSH_KEY` | contents of the **private** key file (`orderhub_deploy_key`) generated in step 3 |
   | `HOSTINGER_PORT` | SSH port from hPanel (Hostinger commonly uses a non-22 port) |
   | `HOSTINGER_APP_DIR` | absolute path to the cloned app directory on the server |

   Optional 6th secret `HOSTINGER_RESTART_CMD` if your app's restart mechanism isn't a
   touched `tmp/restart.txt` (Passenger convention) — e.g. `pm2 restart orderhub` for a
   pm2-managed process.
5. **Pick the production domain**, then:
   - Update `next.config.ts`'s `serverActions.allowedOrigins` (currently has a `TODO`
     comment marking the spot) to include it — Server Actions 403 from any origin not
     listed there.
   - Set `NEXT_PUBLIC_APP_URL` in the server's `.env.local` (step 2) to match.
   - Point the domain's DNS at the Hostinger server per hPanel's instructions.
6. **Test the pipeline**: push a commit to `main` (or re-run this session's Phase 7 commit),
   watch the Action run in GitHub → Actions, then confirm the site is live at the domain.

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
| `canExternalUserSeeResource(resource, viewer)` | Pure visibility rule, shared directly by service + download route |

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
**Current result:** 123/123 pass (fresh run confirmed this session, after the 2 post-Phase-6 fixes)

Tests are pure unit tests — no DB connection, no Supabase, no Next.js. Service functions
that need DB mocking are tested via extracted pure functions (validation rules, visibility
predicates, calculation logic). Keep this pattern. **Run before every commit.**

| Area | Test file(s) | Count |
|---|---|---|
| Authz | `lib/authz/policy.test.ts` | 23 |
| Order status machine | `lib/orders/statusMachine.test.ts` | 34 |
| Duplicate PO | `lib/orders/duplicate.test.ts` | 6 |
| Invoice verification | `lib/orders/invoiceVerification.test.ts` | 11 |
| Schedule/rush fee | `lib/settings/schedule.test.ts` | 9 |
| Production/QC | `lib/production/service.test.ts` | 18 |
| Notification email guard | `lib/notifications/emailGuard.test.ts` | 6 |
| Notification visibility | `lib/notifications/visibility.test.ts` | 3 |
| Resource visibility | `lib/resources/visibility.test.ts` | 4 |
| Operations settings validation | `lib/settings/validate.test.ts` | 9 |
| **Total** | | **123** |

(Per-file counts above were recounted directly from a verbose test run this session —
correcting minor drift from earlier phase docs' approximate figures.)

`tsc --noEmit` and `npm run build` both confirmed clean (zero errors/warnings) as of the
last commit on `main`.

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

**Primitive usage confirmed live** (pre-final audit): Tabs (`catalog-manager.tsx`), Dialog
(4 call sites), DataTable (`catalog-browse.tsx`), MasterDetail (`orders/page.tsx`),
ConfirmDialog (`order-actions.tsx`), Toaster (`app/layout.tsx`). One minor inconsistency:
`production-queue.tsx` renders its own inline tab bar rather than the `Tabs` primitive —
pre-existing from Phase 4, cosmetic only.
