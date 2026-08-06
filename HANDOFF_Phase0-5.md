# OrderHub — Cumulative Handoff: Phase 0 → Phase 5

> **Purpose.** This document gives a new conversation everything needed to resume
> work from after Phase 5 into Phase 6 with no loss of context.
> Created: 2026-08-06. Updated: 2026-08-06 (Phase 5 complete). Update this
> document after completing each phase.

---

## Key Reference Documents

| Document | What it contains |
|---|---|
| [`REBUILD_PLAN.md`](REBUILD_PLAN.md) | Full architecture decisions, build order, phase-by-phase checklist, UX improvements |
| [`CLAUDE.md`](CLAUDE.md) | Codebase instructions, reference app location, rebuild rules, never-edit list |
| [`build_phase_reviews/Phase4_Completion.md`](build_phase_reviews/Phase4_Completion.md) | Phase 4 completion summary (all files created, tests, decisions) |
| [`build_phase_reviews/Phase4_Audit_1.md`](build_phase_reviews/Phase4_Audit_1.md) | Phase 4 audit findings, gap table, navigation path analysis |
| [`build_phase_reviews/Phase4_Audit_2.md`](build_phase_reviews/Phase4_Audit_2.md) | Phase 4 audit fix summary (what landed in the final commit) |
| [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md) | Phase 5 completion summary (invoice verification, release/close, reorder/supplemental, build-blocking fixes) |
| [`HANDOFF_Phase4-5.md`](HANDOFF_Phase4-5.md) | Phase 4→5 handoff (Realtime deferral, stub locations, Phase 5 scope) |
| `original-reference/` | **READ-ONLY.** Reference app at `C:\Users\mjager\Documents\Codex\2026-07-29\...\work\site`. Source of truth for behavior, copy, visuals. Never edit. |

Earlier phase reviews: `Phase2_Completion.md`, `Phase2_Audit_1.md`, `Phase2_Audit_2.md`,
`Phase3_Completion.md`, `Phase3_Audit_1.md`, `Phase3_Audit_2.md`.

---

## Environment Variables (`.env.local`)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL (see Supabase dashboard)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service-role key (bypasses RLS — server-only)

# Database (Supabase Postgres — transaction-mode pooler, IPv4)
DATABASE_URL=                      # postgresql://postgres.<project>:<password>@aws-1-us-west-2.pooler.supabase.com:6543/postgres

# Email (Resend) — NOT YET WIRED; deferred to Phase 6
RESEND_API_KEY=                    # Resend API key
RESEND_FROM_EMAIL=                 # Verified sender address in Resend

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000   # production: https://yourdomain.com
INITIAL_ADMIN_EMAIL=               # First admin's email address; seeded user row links to this on first sign-in

# Business
BUSINESS_TIMEZONE=America/Chicago
```

> **Actual values** are in `.env.local` (not committed). Check that file directly for
> the live project credentials. The Supabase project reference is `biiqvnqesatnrnawxeki`
> (visible in the dashboard URL) — use this to locate the project in the Supabase console.

**Security constraints (must never be broken):**
- Never commit `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-only, never in client code
- `DATABASE_URL` is the Supabase transaction-mode pooler — used by Drizzle; RLS is **not** active on this connection (see Architecture note below)

---

## Architecture Overview

**Stack:** Next.js 16 (App Router, Node runtime) · Supabase Postgres + Auth + Storage ·
Drizzle ORM · Tailwind v4 + `tokens.css` · Radix UI primitives ·
Vitest 4 (unit tests) · Hosted on Hostinger (GitHub push-deploy, deploy step still a stub).

**Data delivery pattern:**
- React Server Components for page data loads
- Server Actions for all mutations (`"use server"`)
- Small `"use client"` islands for interactive UI only
- Route Handlers only for: printable HTML (`/api/production/[id]/print`), CSV export (`/api/catalog/export`), signed file downloads (`/api/product-files/[id]`)

**RLS architecture note (critical):**
Drizzle connects via `SUPABASE_SERVICE_ROLE_KEY` which **bypasses Postgres RLS entirely**.
All data scoping (company, own-scope, customer_visible, internal-only) is enforced by
explicit `WHERE` clauses in app code. RLS policies in migrations are defense-in-depth only.
This is an intentional architectural constraint — the transaction-mode pooler cannot forward
per-request JWT claims, making per-user RLS impractical. Do **not** rely on RLS to enforce
access rules; always verify app-layer scoping.

**Money:** `numeric(12,2)` in DB. `lib/pricing/money.ts` has `toDecimal`, `addMoney`,
`formatMoney`, `parseMoney`. All totals are computed in JS, rounded, stored as decimals.

---

## Auth Details

### Supabase Auth (email + password, invite-only)

- Login: `/login` — email + password via `@supabase/ssr`
- Invite acceptance: `/invite` — new user sets their password
- Auth callback: `/auth/callback` — exchanges PKCE code for session
- No magic-link, no Google SSO. **M365/Entra SSO is a future addition (formally deferred).**
- First admin email comes from `INITIAL_ADMIN_EMAIL` env var (set to `msj1542@gmail.com`)
- All other users must be pre-created in `public.users` by an admin and linked to `auth.users` on first sign-in

### `lib/auth.ts`

```typescript
getUser(): Promise<AppUser | null>         // returns null if no session or no public.users row
requireUser(): Promise<AppUser>            // redirects to /login if not authenticated
getPreviewContext(): Promise<PreviewContext | null>   // reads portal preview cookie
assertNotPreview(preview): void            // throws in portal preview mode
getEffectiveContext(user)                  // resolves preview overlay for display
```

### Portal Preview Mode (Phase 6 feature, stub exists)
An `orderhub_preview` cookie carries `{ companyId, companyName, roleCode }`. When set,
the app renders what a given company/role would see (read-only). Server Actions
**must** call `assertNotPreview(await getPreviewContext())` at the top — this is enforced
throughout all existing actions. **Do not add any write Server Action without this guard.**

### Roles

| Role code | `isInternal` | Description |
|---|---|---|
| `internal_admin` | ✓ | All internal permissions (implicit from `INTERNAL_ADMIN_ACTIONS` set) |
| `order_coordinator` | ✓ | Accept, claim, cancel, release, comment, print labels, manage external users |
| `fulfillment` | ✓ | Claim, QC, piece tally, recuts, print labels. No orders nav. |
| `accounting` | ✓ | Invoice verify, close, comment, production:view |
| `external_admin` | — | Order + manage own company's users |
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

Key actions relevant to Phase 5:
- `order:invoice_verify` — accounting + internal_admin
- `order:release` — order_coordinator + internal_admin  
- `order:close` — accounting + internal_admin
- `order:qc` — fulfillment + internal_admin

---

## App Shell

**Route groups:**
```
app/
  (auth)/login/page.tsx          # Supabase Auth login form
  (auth)/invite/page.tsx         # Invite acceptance (set password)
  auth/callback/route.ts         # PKCE code exchange (route, not page — intentional)
  (app)/layout.tsx               # Shell: sidebar + topbar (RSC, loads session)
  (app)/dashboard/page.tsx
  (app)/orders/page.tsx          # Orders workspace (RSC list + client filter island)
  (app)/orders/new/page.tsx      # New Order builder
  (app)/production/page.tsx      # Production queue RSC
  (app)/catalog/page.tsx
  (app)/settings/catalog/page.tsx
  (app)/settings/materials/page.tsx
  (app)/settings/[section]/page.tsx  # catch-all for other settings
  api/production/[id]/detail/route.ts
  api/production/[id]/print/route.ts
  api/catalog/export/route.ts
  api/product-files/[id]/route.ts
```

Shell features: sidebar nav (role-gated items), topbar with dark mode toggle + sign-out,
`ThemeToggle` (persists to localStorage, flash-prevention script in `<head>`).

---

## Database — Schema & Migrations

Migrations in `supabase/migrations/`. All applied to production Supabase.

| Migration | Tables added |
|---|---|
| `0001_identity.sql` | `roles`, `companies`, `users` + RLS + role seed |
| `0002_catalog_materials.sql` | `materials`, `material_roll_widths`, `products`, `product_materials`, `prices`, `product_files` + Storage bucket |
| `0003_orders.sql` | `application_settings`, `orders`, `order_lines`, `order_comments`, `order_status_history`, `cancellation_requests`, `audit_log` + `order_number_seq` sequence |
| `0004_production.sql` | `production_work_orders`, `production_line_progress`, `production_recuts`, `qc_attestations` |
| `0005_invoice_verification.sql` | `invoice_verifications` |

**Drizzle commands (run from project root):**
```bash
npm run db:generate   # generate migration after schema change
npm run db:migrate    # apply via drizzle-kit (uses DATABASE_URL)
npm run db:studio     # Drizzle Studio
```

For applying raw SQL to production, use the `postgres` npm package (already installed)
with `DATABASE_URL` from `.env.local` — do NOT use `psql` with the password in the
command string (blocked by auto-mode security classifier). See scripts/run-migration.mjs
for the established pattern.

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

**Work order status flow** (parallel, per `production_work_orders.status`):
```
pending (created on order:accept)
  → in_progress (order:claim / Begin Production)
  → completed (order:qc / Finalize Production)
  → awaiting_pickup (set when order reaches ready_for_pickup — Phase 5)
  → released (set when order is released)
  → canceled (if order is canceled)
```

---

## Phase 0–4 Summary

### Phase 0 — Foundations ✅
- Next.js 16 App Router + TypeScript + Tailwind v4 + `tokens.css` design tokens
- All Radix UI primitives installed, themed to token set
- Supabase project provisioned, env wiring complete
- GitHub → Hostinger deploy pipeline (⚠️ deploy step is still a stub — needs Hostinger SSH/API setup before go-live)
- Dark mode toggle shipped (ThemeToggle in topbar, flash-prevention script)
- `components/ui/` primitives: Button, Input, Select, Textarea, Checkbox, Tabs, Dialog, Badge, EmptyState, Toast/Toaster, StatusPill, Alert, FieldHint, DataTable, ConfirmDialog, MasterDetail

### Phase 1 — Auth & Identity ✅
- Supabase Auth (email+password), login/invite/callback pages
- `public.roles`, `public.companies`, `public.users` tables + RLS
- `lib/auth.ts`: `getUser`, `requireUser`, `assertNotPreview`, portal preview cookie
- `lib/authz/policy.ts`: `can(user, action)` — single permission gate
- Role-based sidebar nav; `fulfillment` role sees Production only
- Portal preview mode scaffolded (full UI in Phase 6, server guard works now)
- Sign-out button wired

### Phase 2 — Catalog & Materials ✅
- Schema: `materials`, `material_roll_widths`, `products`, `product_materials`, `prices`, `product_files`
- Catalog browse (search, expandable detail), admin catalog manager + product editor
- Material settings (list, rolls, cost outputs)
- CSV import (validate-then-apply) + CSV export route
- Supabase Storage bucket for product files; signed-URL download route
- `lib/pricing/money.ts`: `formatMoney`, `parseMoney`, `toDecimal`, `addMoney`
- Seed applied: 38 products, 76 price rows (Gloss + Matte)
- **External customer scoping:** `customerVisible` filter applied in `listProducts` for external users (fixed in Phase 2 audit)
- Product file download route checks parent product visibility (fixed in Phase 2 audit)

### Phase 3 — Ordering Core ✅
- Schema: `application_settings`, `orders`, `order_lines`, `order_comments`, `order_status_history`, `cancellation_requests`, `audit_log`
- Status machine (`lib/orders/statusMachine.ts`): 10 transition actions, all transactional
- New Order builder: catalog search, line items, custom items, expedited + rush fee
- Draft save + submit (with duplicate PO check, order number generation)
- Orders workspace (search + status filter chips, URL-synced selection, MasterDetail layout)
- Order detail: header, cancellation banner, action buttons, line items, totals, notes, comment thread
- Order actions: accept (with expected completion date), cancel (with reason), request cancellation, decline cancellation, delete draft
- Comment composer: customer-visible vs. internal toggle
- `lib/orders/duplicate.ts`: configurable window (default 3 days)
- `lib/settings/schedule.ts`: `computeExpectedCompletion` (cutoff-week algorithm), `computeRushFee`
- `lib/settings/tz.ts`: `formatInTz`, `todayInTz`, `parseDateStr`, `toDateStr`
- **Action dispatch note:** `acceptOrderAction(id, "release")` and `acceptOrderAction(id, "close")` currently return friendly stub messages (not errors). These become real implementations in Phase 5.

### Phase 4 — Production Queue ✅
- Schema: `production_work_orders`, `production_line_progress`, `production_recuts`, `qc_attestations`
- `acceptOrder()` creates a `pending` work order in the same transaction
- `claimOrder()` transitions work order `pending → in_progress` and order `accepted → in_fulfillment`
- `lib/production/service.ts`: `listWorkOrders`, `getWorkOrder`, `claimWorkOrder`, `updatePieceProgress`, `recordRecut`, `submitQC`
- Production queue UI: tabs (Current Work / Completed On Site / Released Archived / All), expandable rows, lazy-loaded detail
- Piece tally: ≤45 individual numbered squares; >45 batched-5 groups
- Action buttons: Begin Production, Record Non-Billable Re-cut, Finalize Production, Print Work Order, Print Labels
- QC modal: 3 required items + attestation checkbox (unlocks only after all 3 checked)
- Recut modal: line selector, quantity, reason, material usage estimate `(patternLengthIn + 1) × qty`
- Print route: `/api/production/[id]/print?type=work-order|labels` — auto-printing HTML; labels have SVG QR codes with SHA-256 trace codes (first 12 hex chars of `${workOrderId}:${lineId}:${seqNum}:${orderNumber}:original`)
- `WorkOrderSection` component on order detail (internal users only): WO status, assigned user, due date, piece progress `done/total (pct%)`, Print Work Order + Print Labels links
- `OrderFull` type extended with `workOrder: OrderWorkOrderBrief | null`
- `getOrder()` loads the work order brief (alias join on `claimed_by` + progress count)
- Dashboard: "Work Orders Pending" stat card for users with `production:view`
- Migration `0004_production.sql` applied to production Supabase
- 82/82 tests passing (latest: commit `becf909`)

---

## Test Infrastructure

**Runner:** Vitest 4 (`npm test`)  
**Location:** `lib/**/*.test.ts` (alongside source files)  
**Current result:** 101/101 pass (Phase 5)

| Test file | Tests | What it covers |
|---|---|---|
| `lib/authz/policy.test.ts` | 23 | Role × action matrix, pricing:view special case |
| `lib/orders/statusMachine.test.ts` | 30 | Valid transitions, cancel paths, delete_draft, release/close/invoice_verify guards |
| `lib/orders/duplicate.test.ts` | 6 | Duplicate PO detection logic |
| `lib/orders/invoiceVerification.test.ts` | 9 | Invoice verification validation (discrepancy tolerance, required fields, attestation) |
| `lib/settings/schedule.test.ts` | 9 | computeExpectedCompletion (5 cases), computeRushFee (4 cases) |
| `lib/production/service.test.ts` | 18 | QC validation, material usage calc, piece progress validation, WO status ordering |

Tests are pure unit tests — no DB connection, no Supabase, no Next.js. Service functions
that need DB mocking are tested via extracted pure functions. Keep this pattern.

**Run before every commit.**

---

## Known Issues & Open Items

### Items Formally Deferred (planned for a specific later phase)

| Item | Deferred to | Detail |
|---|---|---|
| **Realtime (Supabase Realtime)** | Phase 6 | Production queue uses `router.refresh()`. No Supabase channel wired. Acceptable for MVP. |
| **Resend / transactional email** | Phase 6 | Package installed, env vars present, no code wired yet. |
| **Resource library** | Phase 6 | File upload/download to Supabase Storage; resource categories; versioning. |
| **Full Settings hub** | Phase 6 | Companies editor, internal user manager, operations settings (rush fee, cutoff, completion weekday), audit history. |
| **In-app notifications** | Phase 6 | No notification table, no notification service, no bell UI yet. |
| **Portal preview modal UI** | Phase 6 | Cookie mechanism and server guard exist. Admin UI to set/clear the cookie not yet built. |
| **Production queue text search** | Phase 7 | Tab + status filtering is current capability. |
| **Server-side pagination** | Phase 7 | All list views load all rows; client-side filtering only. |
| **CSV import field-level diff** | Phase 7 | Preview shows additions/change counts but not before/after field values. |
| **Dark mode toggle** | ✅ Shipped (Phase 0) | Already done. |
| **M365 / Entra ID SSO** | Later (post-MVP) | Email + password ships. |
| **Reminder/escalation scheduler** | Later (post-MVP) | pg_cron. Recipients + thresholds undefined. |
| **Hostinger deploy step** | Before go-live | GitHub Action for Drizzle migrations + Hostinger build/deploy is a stub. |
| `serverActions.allowedOrigins` | Before go-live | Add Hostinger production domain to `next.config` before deploying to prod. |

### Stubs Replaced in Phase 5 ✅

`app/(app)/orders/actions.ts`'s `"release"`/`"close"` dispatch arms now call the real
`releaseOrder(orderId, user)` / `closeOrder(orderId, user)` service functions. A new
`invoiceVerifyAction(orderId, input)` action + `InvoiceVerifyModal` component handle the
`"invoice_verify"` transition, which previously had no entry point at all.

### Phase 5 Entry Points ✅ (previously scaffolded, now wired)

- **Supplemental orders** — "Add Supplemental Order" button now on `order-actions.tsx`
  (internal only, `accepted`+ statuses, not itself a supplemental order).
- **Reorder mode** — "Reorder" button now on `order-actions.tsx` (any status except
  draft/canceled); `orders/new/page.tsx` loads the source order and rebuilds line items
  against the current catalog.

### Minor Outstanding Gaps (Low Priority — Not Breaking)

- Orders workspace **scope tabs** (e.g., "Needs My Action" tab for internal coordinators) are not built. Search + status filter exist. Deferred — acceptable for Phase 5+.
- `WorkOrderSection` shows `dueDate` as a raw string (the value stored in `production_work_orders.due_date`). No formatting applied. Low friction, cosmetic.

---

## Phase 5 — Accounting & Lifecycle ✅

Full detail in [`build_phase_reviews/Phase5_Completion.md`](build_phase_reviews/Phase5_Completion.md). Summary:

- **Invoice verification**: `lib/orders/invoiceVerification.ts` (pure validation — invoice
  number required, discrepancy reason required whenever invoice total differs from
  `grandTotal` by more than $0.005, attestation required) + `invoiceVerifyOrder()` in
  `lib/orders/service.ts` (role gate → status-machine gate → transaction: order →
  `ready_for_pickup`, work order → `awaiting_pickup`, inserts `invoice_verifications` row,
  status history, audit log). UI: `components/orders/invoice-verify-modal.tsx` shows the
  real order lines/totals, not a fake 3-checkbox form.
- **Release / Close**: `releaseOrder()` / `closeOrder()` in `lib/orders/service.ts` replace
  the Phase 3/4 stub dispatch arms in `app/(app)/orders/actions.ts`. Same transactional
  pattern as `acceptOrder`/`claimOrder` (status + timestamp + work order status + status
  history + audit log, all in one `db.transaction`).
- **Reorder / Supplemental entry points**: "Reorder" and "Add Supplemental Order" buttons
  on `order-actions.tsx`, routing to `/orders/new?reorder_from=` / `?supplemental_to=`.
  `app/(app)/orders/new/page.tsx` resolves the source order (via the existing scoped
  `getOrder()`) and rebuilds line items against the *current* product/pricing catalog —
  reorder prefills lines + company; supplemental prefills company only (new items against
  an existing order, not a copy of it).
- **Build-blocking fixes (pre-existing, not Phase 5 regressions — confirmed present on the
  Phase 4 baseline commit `becf909` before any Phase 5 change)**:
  - `lib/production/constants.ts` (new): `QC_ITEMS`/`QC_KEYS` moved out of
    `lib/production/service.ts` (which imports the Postgres driver) into a pure module,
    because `qc-modal.tsx` (a client component) was importing them from `service.ts` and
    pulling `node:tls`/`node:perf_hooks` into the browser bundle — `npm run build` failed
    unconditionally. `service.ts` still re-exports both for existing consumers.
  - `components/ui/button.tsx`: added `asChild` support (`@radix-ui/react-slot`, already
    a dependency) — `app/(app)/orders/page.tsx`'s `<Button asChild><Link>…` usage predates
    Phase 5 but never type-checked because `Button` never declared the prop.
  - **Without both fixes the app could not produce a production build at all**, in any phase.
- **Tests**: 101/101 passing (was 82; +9 in `lib/orders/invoiceVerification.test.ts`, +10
  in `lib/orders/statusMachine.test.ts` for release/close/invoice_verify guards).
- **Known follow-up**: browser E2E of invoice-verify → release → close, reorder, and
  supplemental was not performed this session — signing in requires entering a password,
  which is outside what an agent may do. Verified via passing tests, a clean
  `npm run build`, and code review against the existing accept/claim/cancel transaction
  patterns. Recommend a manual click-through before treating Phase 5 as fully closed.

---

## Phase 6 Starting Point

**Commit at handoff:** see `git log` for the Phase 5 commit (invoice verification, release/close, reorder/supplemental)
**Tests:** 101/101 passing
**Branch:** `main`

### Phase 6 Objectives (from REBUILD_PLAN.md: "Resources, notifications, settings")

- Resource library + manager (Supabase Storage, versions, pricing-restricted)
- In-app notifications + Resend transactional email
- Settings hub: companies, internal users manager, operations/schedule settings
  (rush fee, cutoff/completion weekday, duplicate window, timezone), audit history
- Portal preview modal UI (cookie mechanism + server guard already exist from Phase 1)
- Realtime (Supabase Realtime) for the production queue and notifications — deferred
  from Phase 4 per the plan's fallback clause; pick this back up here
- Recommend also budgeting time for a manual browser click-through of Phase 5's new
  flows (invoice verify, release, close, reorder, supplemental), since it wasn't possible
  to verify in-browser this session without entering login credentials

### Phase 6 Non-Goals (Do Not Add)
- Search/pagination → Phase 7
- Reminder/escalation scheduler (pg_cron), M365/Entra SSO → post-MVP, no committed phase

---

## Service Layer Quick-Reference

### `lib/orders/service.ts`
| Function | What it does |
|---|---|
| `listOrders(user, filters)` | Scoped list (company/own based on role + scope) |
| `getOrder(id, user)` | Full order + lines + comments + cancel req + work order brief |
| `saveOrSubmitOrder(user, input, mode)` | Create/update draft or submit |
| `deleteDraft(orderId, user)` | Soft-delete draft (audit log survives) |
| `addComment(orderId, user, body, isInternal)` | Comment thread append |
| `acceptOrder(orderId, user, expectedCompletionDate?)` | `submitted → accepted` + creates WO |
| `claimOrder(orderId, user)` | `accepted → in_fulfillment` + WO `pending → in_progress` |
| `requestCancellation(orderId, user, reason)` | Sets cancel flag, inserts `cancellation_requests` row |
| `cancelOrder(orderId, user, reason)` | `submitted/accepted → canceled`, resolves cancel req |
| `declineCancellation(orderId, user, reason?)` | Clears cancel flag, resolves cancel req |
| `getDashboardCounts(user)` | Stat card counts for dashboard |
| `invoiceVerifyOrder(orderId, input, user)` | `fulfillment_completed → ready_for_pickup`, WO → `awaiting_pickup`, inserts `invoice_verifications` |
| `releaseOrder(orderId, user)` | `ready_for_pickup → released`, WO → `released` |
| `closeOrder(orderId, user)` | `released → closed` |

### `lib/orders/invoiceVerification.ts` (pure, no DB import)
| Function | What it does |
|---|---|
| `validateInvoiceVerification(input, grandTotal)` | Returns an error string or null; enforces invoice number, non-negative total, discrepancy reason on mismatch >$0.005, attestation |
| `hasDiscrepancy(invoiceTotal, grandTotal)` | Shared tolerance check, also used by the modal |

### `lib/production/service.ts`
| Function | What it does |
|---|---|
| `listWorkOrders(user, tab)` | Scoped list by tab (current/completed/archived/all) |
| `getWorkOrder(id, user)` | Full WO with lines, progress, recuts |
| `claimWorkOrder(workOrderId, user)` | Delegates to `claimOrder()` via orderId lookup |
| `updatePieceProgress(woId, lineId, pieces[], user)` | Check-then-upsert piece tally |
| `recordRecut(woId, lineId, qty, reason, user)` | Validates + inserts recut row |
| `submitQC(woId, answers, notes, user)` | Validates all 3 QC keys, inserts attestation, transitions WO + order |

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

All existing actions in `orders/actions.ts`, `orders/new/actions.ts`,
`production/actions.ts`, `settings/catalog/actions.ts`, `settings/materials/actions.ts`
follow this pattern. Any new Phase 5 action must do the same.

---

## QC Constants (`lib/production/service.ts`)

```typescript
export const QC_ITEMS: [string, string][] = [
  ["orderAccuracy",      "Order accuracy — Correct SKUs, quantities, and material"],
  ["finishQuality",      "Finish quality — Clean, dry, and free of bubbles or lifted edges"],
  ["completionPackaging","Completion — All pieces present, labeled, and packaged correctly"],
];
```

These 3 keys must all be `true` in `answers` and `attested: true` for `submitQC()` to pass.
Invoice verification in Phase 5 will follow the same attestation pattern but with different fields.

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
