# OrderHub — Phase 3 → Phase 4 Handoff

This document is the single source of context for a new conversation picking up at
Phase 4. **Read these three files first, in this order:**

1. [`REBUILD_PLAN.md`](REBUILD_PLAN.md) — full product spec, architecture decisions, build order
2. [`CLAUDE.md`](CLAUDE.md) — repo instructions, reference app location, rebuild rules
3. This file — current state, all decisions made through Phase 3, exact Phase 4 starting point

**Phase 3 build trail:**
- [`build_phase_reviews/Phase3_Completion.md`](build_phase_reviews/Phase3_Completion.md) — all files created/modified in Phase 3

**Prior handoffs (for deeper context):**
- [`HANDOFF_Phase2-3.md`](HANDOFF_Phase2-3.md) — Phase 0–2 decisions, env vars, architecture, full file structure

---

## 1. Repository state

**GitHub:** https://github.com/msj1542/OrderHub  
**Branch:** `main` (single branch; no PR workflow yet)  
**Confirm with `git status` before starting.** Phase 3 commits should be the most recent.

**Commits added in Phase 3:**
```
(Phase 3 commits — check git log for exact hashes)
  Phase 3: Orders core — schema, service, workspace, new-order builder, actions
```

---

## 2. Stack & tooling

*(Unchanged from Phase 2 — see HANDOFF_Phase2-3.md §2 for full table)*

**Dev commands (run from repo root):**
```bash
npm run dev           # Next.js + Turbopack on :3000
npm test              # vitest (64 tests, all passing as of Phase 3)
npm run lint          # eslint
npm run db:generate   # drizzle-kit generate (after schema.ts changes)

# Scripts — always pass --env-file=.env.local
node --env-file=.env.local scripts/run-migration.mjs <file.sql>
node --env-file=.env.local scripts/bootstrap-admin.mjs
node --env-file=.env.local scripts/seed-catalog.mjs
```

---

## 3. Environment variables

All vars live in `.env.local` (gitignored). **Never commit this file.**

| Variable | Purpose | Required in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (`sb_publishable_…`) | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (`sb_secret_…`); bypasses RLS | Server only |
| `DATABASE_URL` | Postgres connection — **transaction-mode pooler port 6543** | Server (Drizzle) |
| `INITIAL_ADMIN_EMAIL` | First `internal_admin` email (bootstrap script) | Scripts only |
| `BUSINESS_TIMEZONE` | IANA tz string for schedule computations (`America/Chicago`) | Server |
| `NEXT_PUBLIC_APP_URL` | Full app URL for invite redirect links | Scripts |

**Not yet needed (add in Phase 6):**
- `RESEND_API_KEY` — Resend transactional email
- `RESEND_FROM_EMAIL` — From address for outbound emails

---

## 4. Supabase project

**Project ID:** `biiqvnqesatnrnawxeki`  
**Region:** `aws-1-us-west-2`  
**Pooler:** Transaction-mode (port 6543) — used in `DATABASE_URL`  
**Key format:** New Supabase format (`sb_publishable_…` / `sb_secret_…`)

**Migrations applied to production:**
- `0001_auth_identity.sql` — roles, companies, users, RLS, trigger
- `0002_catalog_materials.sql` — 6 catalog tables, RLS, Storage bucket, seed materials/rolls
- `0003_orders.sql` — 6 order tables + application_settings + order_number_seq

---

## 5. Architecture decisions & deviations

*(All decisions from Phases 0–2 carry forward unchanged — see HANDOFF_Phase2-3.md §5)*

### Phase 3 decisions

#### Decision 4 — computeExpectedCompletion anchors to the current work-week's Friday

**Algorithm:** "Work week" is anchored to the cutoff weekday (Monday). Find how many days since the cutoff day to determine which week we're in. Find the completion Friday of that same week. If past the cutoff → add 7 days (following week).

**Business rule (verified against reference):** Only orders placed on the cutoff weekday itself before the cutoff TIME get "this week's Friday." Any order placed on Tuesday–Sunday (or Monday after noon) is already past the cutoff and gets next week's Friday.

**Effect:** Wednesday, Friday, Saturday orders all complete the following Friday. Only Monday-before-noon completes the same Friday (4 days later).

#### Decision 5 — Order numbers generated with `nextval('order_number_seq')` inside transaction

Format: `OH-{YYYY}-{seq_padded_5}` (e.g. `OH-2025-00001`). The sequence is monotone-increasing and guaranteed unique. Generated at submit time (not draft creation). Draft orders have `order_number = NULL`.

#### Decision 6 — Order line validation at submit time

`saveOrSubmitOrder()` validates each line when `mode === "submit"`:
- Product must be `is_active=true`
- Material must be `is_active=true`
- Product must support the chosen material (via `product_materials` join)
- An active price must exist
- Roll width must be available for the material

Custom items (`is_custom=true`) skip catalog validation but must have a description and price ≥ 0.

#### Decision 7 — Duplicate PO check

Runs at submit time only (not draft save). Checks within `settings.duplicateWindowDays` of the submit timestamp. Excludes `draft` status rows and the current order itself. External users see a warning with the existing order number; they can "Submit Anyway" to override.

#### Decision 8 — application_settings seed values

Seeded in `0003_orders.sql`:
- `business_timezone` = `America/Chicago`
- `rush_fee_mode` = `percentage`
- `rush_fee_value` = `20`
- `cutoff_weekday` = `Monday`
- `cutoff_time` = `12:00`
- `completion_weekday` = `Friday`
- `completion_time` = `15:30`
- `duplicate_window_days` = `3`

---

## 6. What is built and production-ready (Phases 0–3)

### Phases 0–2 ✅
*(See HANDOFF_Phase2-3.md §6 for full detail)*

### Phase 3 — Orders core ✅

**Database (applied to production Supabase):**
- `supabase/migrations/0003_orders.sql` — 7 new DB objects:
  - `application_settings` (key/value config)
  - `orders` (id, order_number, company_id, created_by_user_id, status, is_expedited, requested_date, expected_completion_date, po_number, supplemental_to_order_id, customer_notes, internal_notes, subtotal/rush_fee/adjustment/grand_total as numeric(12,2), cancellation_requested, submitted/accepted/released/closed timestamps)
  - `order_lines` (id, order_id, product_id, material_id, sku_snapshot, description_snapshot, attributes_snapshot, quantity, unit_price, line_total, pricing_status, is_custom)
  - `order_comments` (id, order_id, user_id, body, is_internal)
  - `order_status_history` (id, order_id, previous_status, new_status, changed_by, reason)
  - `cancellation_requests` (id, order_id, requested_by_user_id, reason, status, resolved_by/at)
  - `audit_log` (id, user_id, company_id, order_id, entity_type, entity_id, action, previous_value, new_value, reason)
  - `order_number_seq` sequence

**Drizzle schema (`lib/db/schema.ts`):**
- 6 new tables + relations
- Types added: `OrderStatus`, `ORDER_STATUS_LABELS`, `OrderSummary`, `OrderFull`

**Order service (`lib/orders/service.ts`):**
- `listOrders(user, filters)` → `OrderSummary[]` — scope-enforced
- `getOrder(id, user)` → `OrderFull | null` — scope-enforced; filters isInternal comments for external
- `saveOrSubmitOrder(user, input, mode)` — full validation + totals + duplicate check + transaction
- `deleteDraft(orderId, user)` — hard delete with audit log
- `addComment(orderId, user, body, isInternal)` — permission-gated
- `acceptOrder(orderId, user, expectedCompletionDate?)` — transactional status change
- `requestCancellation(orderId, user, reason)` — external only
- `cancelOrder(orderId, user, reason)` — resolves pending requests
- `declineCancellation(orderId, user, reason?)` — clears pending request
- `getDashboardCounts(user)` → `DashboardCounts`

**Status machine (`lib/orders/statusMachine.ts`):**
- 10 transition actions with `fromStatuses`, `toStatus`, `authzAction`
- `getTransition(action, status)` — returns rule or null
- `assertCanTransition(action, status, label?)` — throws on invalid

**Settings / schedule (`lib/settings/schedule.ts`, `lib/settings/tz.ts`):**
- `getSettings()` — reads `application_settings` from DB; env-var fallbacks
- `computeExpectedCompletion(settings, now)` — week-anchored algorithm
- `computeRushFee(subtotal, settings)` — percentage/flat/disabled
- Timezone helpers: `formatInTz`, `todayInTz`, `parseDateStr`, `toDateStr`

**Pages:**
- `app/(app)/orders/page.tsx` — RSC orders workspace with MasterDetail
- `app/(app)/orders/new/page.tsx` — RSC new order form (loads catalog/companies)
- `app/(app)/dashboard/page.tsx` — real dashboard with stat cards + quick links

**Server actions:**
- `app/(app)/orders/actions.ts` — accept, cancel, requestCancellation, declineCancellation, deleteDraft, addComment
- `app/(app)/orders/new/actions.ts` — saveOrder, submitOrder (duplicate_order bubble)

**UI components (new in Phase 3):**
- `components/ui/confirm-dialog.tsx` — ConfirmDialog (Dialog wrapper + variant + async onConfirm)
- `components/ui/master-detail.tsx` — responsive list+detail split layout
- `components/orders/orders-workspace.tsx` — search + status filter + URL-synced selection
- `components/orders/order-detail.tsx` — header, cancellation banner, actions, lines, totals, notes, comments
- `components/orders/order-actions.tsx` — all action buttons gated by can* props
- `components/orders/comment-composer.tsx` — FormData-based; internal toggle for staff
- `components/orders/new-order.tsx` — full order builder (catalog search, line cards, custom item, expedited, summary, dual submit)

**Tests (64 total, all passing):**
- `lib/authz/policy.test.ts` — 23 tests (Phase 1)
- `lib/orders/statusMachine.test.ts` — 20 tests
- `lib/orders/duplicate.test.ts` — 6 tests
- `lib/settings/schedule.test.ts` — 9 tests (5 computeExpectedCompletion + 4 computeRushFee)
- `lib/catalog/csv.test.ts` — 6 tests (Phase 2)

---

## 7. UI component library (full inventory as of Phase 3)

| Component | File | Notes |
|---|---|---|
| Button | `components/ui/button.tsx` | CVA: primary/secondary/danger/success/ghost/link × md/sm |
| Input | `components/ui/input.tsx` | Token ring focus |
| Label | `components/ui/label.tsx` | Radix Label wrapper |
| Textarea | `components/ui/textarea.tsx` | Token-styled |
| Checkbox | `components/ui/checkbox.tsx` | Radix Checkbox wrapper |
| Select | `components/ui/select.tsx` | Radix — Trigger/Content/Item/Label/Separator |
| Tabs | `components/ui/tabs.tsx` | Radix — List/Trigger/Content (underline style) |
| Dialog | `components/ui/dialog.tsx` | Radix — Content/Header/Footer/Title/Description |
| Badge | `components/ui/badge.tsx` | CVA: default/neutral/info/success/warning/danger/urgent/completed |
| StatusPill | `components/ui/status-pill.tsx` | `ORDER_STATUS_FAMILY` map (7 families) |
| Alert | `components/ui/alert.tsx` | info/success/warning/danger; Lucide icons |
| DataTable | `components/ui/data-table.tsx` | Generic sortable table + expandable rows |
| EmptyState | `components/ui/empty-state.tsx` | Centered icon + title + description + optional action |
| FieldHint | `components/ui/field-hint.tsx` | Radix Tooltip with HelpCircle icon |
| ThemeToggle | `components/ui/theme-toggle.tsx` | Moon/Sun; localStorage + data-theme |
| Toaster | `components/ui/toaster.tsx` | Radix Toast viewport; in root layout |
| ConfirmDialog | `components/ui/confirm-dialog.tsx` | Dialog wrapper; variant danger/primary; async onConfirm ✅ Phase 3 |
| MasterDetail | `components/ui/master-detail.tsx` | Responsive list+detail split layout ✅ Phase 3 |

**Still needed for Phase 4+:**
- `Toggle` — settings boolean switch (Phase 6)
- `Timeline` — audit history list (Phase 6)
- `FormGrid` — consistent form layout (Phase 6)

---

## 8. Test infrastructure

**Runner:** Vitest 4 (`npm test`)  
**Config:** `vitest.config.ts` with `@vitejs/plugin-react`, `@` path alias

**Current results:** 64/64 passing

**Test files:**
```
lib/authz/policy.test.ts         — 23 tests (roles × actions)
lib/catalog/csv.test.ts          — 6 tests (CSV import validation)
lib/orders/statusMachine.test.ts — 20 tests (transition machine)
lib/orders/duplicate.test.ts     — 6 tests (duplicate PO detection)
lib/settings/schedule.test.ts    — 9 tests (schedule computation + rush fee)
```

**Phase 4 should add tests for:**
- Production work-order creation (from acceptOrder)
- QC attestation (all items answered true before status advances)
- Work-order scoping (fulfillment user sees only their claimed work orders)

---

## 9. Deferred items (carry into Phase 4+)

### From Phase 3

| Item | Notes |
|---|---|
| `acceptOrder` should create a `production_work_orders` row | Currently only changes status. Phase 4 adds the `production_work_orders` table and wires it in. |
| Supplemental order mode in New Order builder | `new-order.tsx` has a `mode` prop for 'new'/'reorder'/'supplemental' but supplemental-specific validation (linked parent, separate pricing) is stubbed. Phase 3 built the UI shell; Phase 4 or 5 should complete the business logic. |
| Rush fee settings UI | `application_settings` are seeded but no admin UI yet to change them. Phase 6 / Settings hub. |
| `invoice_verify` action | Service action is in `statusMachine` but not wired to a UI action button (needs invoice total entry). Phase 5. |

### From Phases 1–2 (still open)

| Item | Target phase |
|---|---|
| Transactional email (Resend) | Phase 6 |
| GitHub Actions deploy step (Hostinger) | Pre-go-live |
| Portal preview modal | Phase 6 |
| Reminder/escalation scheduler (pg_cron) | Deferred indefinitely |
| CSV field-level diff in import preview | When catalog actively used |

---

## 10. Phase 4 — Production queue

### What Phase 4 builds (from REBUILD_PLAN.md)

> **Phase 4 — Production queue.** `production_work_orders` schema, work-order creation on accept,
> fulfillment queue (claim/start/QC), piece completion, non-billable recut recording,
> print-labels action (QR codes).

### New schema (new migration file: `0004_production.sql`)

**`production_work_orders`**
- `id`, `order_id` (→ orders), `claimed_by_user_id` (→ users, nullable), `status` (pending|in_progress|qc_ready|completed), `qc_completed_at`, `created_at`, `updated_at`

**`work_order_pieces`** (or equivalent)
- Per-line completion tracking: `work_order_id`, `order_line_id`, `quantity_completed`, `recut_count`, `is_complete`, `completed_at`

**`qc_attestations`** (optional — may be inline on work order)
- One row per QC item per work order; all must be true before `qc` transition succeeds

### Key service actions for Phase 4

Reference guards from `original-reference/app/api/orders/[id]/action/route.ts`:
- `claim` — `fulfillment` or `internal_admin`; `accepted` → `in_fulfillment`; creates a `production_work_orders` row + links to the claiming user
- `qc` — `fulfillment` or `internal_admin`; `in_fulfillment` → `fulfillment_completed`; requires all `QC_ITEMS` answered true
- QC items (from reference): verify all pieces cut, verify all pieces QC'd, verify labeling complete (exact list in `original-reference/app/api/orders/[id]/action/route.ts`)

### Production queue UX

Reference: `original-reference/app/ordering-hub-app.tsx` → `ProductionQueueView`

- Tabs: Current Work / Completed-On Site / Released-Archived
- Fulfillment users see their own claimed orders
- Piece-by-piece completion tally (each line item has a `quantityCompleted` counter)
- Non-billable recut recording (separate `recut_count` not billed to customer)
- Print labels action: generates QR-coded label for each order line (SVG/PNG; reference uses `qrcode` npm package)
- Work-order detail: order summary, line items with piece counts, QC checklist, notes

### Reference files to read before building

```
original-reference path:
C:\Users\mjager\Documents\Codex\2026-07-29\ordering-hub-sites-project-appgprj-6a6a8e869e3081918c3c61a26d78c2d8-2\work\site\

Key files for Phase 4:
  db/schema.ts                              — productionWorkOrders table definition
  app/ordering-hub-app.tsx                  — ProductionQueueView UI
  app/api/orders/[id]/action/route.ts       — claim + qc action guards (QC_ITEMS constant)
```

### Pages to build in Phase 4

| Route | Type | What it does |
|---|---|---|
| `app/(app)/production/page.tsx` | RSC | Production queue (replace placeholder) |

---

## 11. Full file structure (as of Phase 3 completion)

```
app/
  layout.tsx                            # root: theme flash-script, Toaster, Radix ToastProvider
  globals.css                           # Tailwind base @import
  tokens.css                            # all design tokens (light + dark)
  page.tsx                              # root redirect → /dashboard

  (auth)/
    login/page.tsx + actions.ts         # email+password sign-in
    invite/page.tsx + actions.ts        # set display name + password on first login

  (app)/
    layout.tsx                          # RSC app shell: requireUser, sidebar, topbar
    actions.ts                          # signOutAction, exitPreviewAction
    dashboard/page.tsx                  # ✅ real dashboard: stat cards, quick links
    orders/page.tsx                     # ✅ RSC orders workspace (MasterDetail)
    orders/new/page.tsx                 # ✅ RSC new order form
    orders/actions.ts                   # ✅ accept/cancel/requestCancellation/declineCancellation/deleteDraft/addComment
    orders/new/actions.ts               # ✅ saveOrder/submitOrder
    production/page.tsx                 # placeholder → Phase 4 target
    resources/page.tsx                  # placeholder → Phase 6 target
    notifications/page.tsx              # placeholder → Phase 6 target
    company-users/page.tsx              # placeholder → Phase 6 target
    catalog/page.tsx                    # ✅ RSC: loads products+materials; renders CatalogBrowse
    settings/
      layout.tsx                        # ✅ settings shell: requires settings:manage; SettingsNav
      catalog/page.tsx + actions.ts     # ✅ CatalogManager + save/upload/import actions
      materials/page.tsx + actions.ts   # ✅ MaterialSettingsPanel + roll-width actions
      [section]/page.tsx                # catch-all: companies|team|resources|operations|audit

  auth/
    callback/page.tsx                   # ✅ client: handles all Supabase link types

  api/
    catalog/export/route.ts             # ✅ GET: CSV export (SKU, GlossPrice, MattePrice…)
    product-files/[id]/route.ts         # ✅ GET: signed-URL redirect (60s); product-access gated

components/
  layout/
    sidebar.tsx                         # client; role-based nav; sign-out form
    topbar.tsx                          # client; pathname title; ThemeToggle; notifications bell
    preview-banner.tsx                  # client; exit-preview form action
    settings-nav.tsx                    # client; 7 settings tabs, permission-filtered
  ui/
    alert.tsx                           # info/success/warning/danger; Lucide icons
    badge.tsx                           # CVA: 8 variants
    button.tsx                          # CVA: 6 variants × 2 sizes
    checkbox.tsx                        # Radix Checkbox
    confirm-dialog.tsx                  # ✅ Phase 3: ConfirmDialog (Dialog wrapper + variant)
    data-table.tsx                      # generic sortable + expandable rows
    dialog.tsx                          # Radix Dialog
    empty-state.tsx                     # icon + title + description + action
    field-hint.tsx                      # Radix Tooltip + HelpCircle icon
    input.tsx                           # token-styled input
    label.tsx                           # Radix Label
    master-detail.tsx                   # ✅ Phase 3: responsive list+detail split
    select.tsx                          # Radix Select
    status-pill.tsx                     # StatusPill + ORDER_STATUS_FAMILY map
    tabs.tsx                            # Radix Tabs
    textarea.tsx                        # token-styled textarea
    theme-toggle.tsx                    # Moon/Sun; localStorage + data-theme
    toaster.tsx                         # Radix Toast viewport
  catalog/
    catalog-browse.tsx                  # client: search + DataTable + expandable detail
    catalog-manager.tsx                 # client: product list + editor/import tabs
    catalog-details.tsx                 # server-compatible: specs, pricing, files, thumbnail
    csv-import.tsx                      # client: type select, file input, preview+apply forms
    material-settings.tsx               # client: material list + roll-width editor
    product-editor.tsx                  # client: full product form (useActionState)
  orders/
    comment-composer.tsx                # ✅ Phase 3: client FormData-based comment + internal toggle
    new-order.tsx                       # ✅ Phase 3: full order builder client component
    order-actions.tsx                   # ✅ Phase 3: action buttons gated by can* props
    order-detail.tsx                    # ✅ Phase 3: header, lines, totals, notes, comments
    orders-workspace.tsx                # ✅ Phase 3: search + filter chips + URL-synced selection

lib/
  auth.ts                               # getUser, requireUser, preview helpers
  authz/
    policy.ts                           # can(), canAny(), Action type, 28 actions × 7 roles
    roles.ts                            # ROLES enum, RoleCode type
    policy.test.ts                      # 23 vitest tests — all passing
  catalog/
    csv.ts                              # parseCsv, ImportReport, validators
    csv.test.ts                         # 6 tests
    service.ts                          # listMaterials, listProducts, getProduct, CRUD
  db/
    schema.ts                           # Drizzle: all tables + relations + composite types
    index.ts                            # Drizzle client (service-role, transaction-mode pooler)
  hooks/
    use-toast.ts                        # toast(), dismiss(), useToast()
  orders/
    duplicate.ts                        # checkDuplicatePO()
    duplicate.test.ts                   # 6 tests
    service.ts                          # listOrders, getOrder, saveOrSubmitOrder, all actions
    statusMachine.ts                    # TRANSITIONS, getTransition, assertCanTransition
    statusMachine.test.ts               # 20 tests
  pricing/
    money.ts                            # formatMoney, parseMoney, toDecimal, addMoney
  settings/
    schedule.ts                         # getSettings, computeExpectedCompletion, computeRushFee
    schedule.test.ts                    # 9 tests
    tz.ts                               # formatInTz, todayInTz, parseDateStr, toDateStr
  supabase/
    admin.ts                            # createAdminClient() — service-role
    client.ts                           # createClient() — browser components
    server.ts                           # createClient() — RSC, Server Actions, Route Handlers
  utils.ts                              # cn()

scripts/
  bootstrap-admin.mjs
  check-auth-state.mjs
  check-db.mjs
  resend-invites.mjs
  run-migration.mjs
  seed-catalog.mjs
  verify-connection.mjs

supabase/
  migrations/
    0001_auth_identity.sql
    0002_catalog_materials.sql
    0003_orders.sql                     # ✅ Phase 3: orders + application_settings + seq
```

---

## 12. Running the app locally

```bash
# 1. Install (skip if node_modules present)
npm ci

# 2. Start dev server
npm run dev   # → http://localhost:3000

# 3. Sign in with msj1542@gmail.com at /login

# 4. Run tests
npm test   # should be 64/64
```

---

## 13. Known TypeScript issue (pre-existing, non-blocking)

`tsc --noEmit` reports one error:
```
.next/types/validator.ts(161,39): error TS2307:
  Cannot find module '../../app/auth/callback/route.js'
```

Stale generated type from Phase 1. Does not affect runtime. Clears with `rm -rf .next`. Treat zero other type errors as the passing bar.
