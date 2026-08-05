# OrderHub — Phase 2 → Phase 3 Handoff

This document is the single source of context for a new conversation picking up at
Phase 3. **Read these three files first, in this order:**

1. [`REBUILD_PLAN.md`](REBUILD_PLAN.md) — full product spec, architecture decisions, build order
2. [`CLAUDE.md`](CLAUDE.md) — repo instructions, reference app location, rebuild rules
3. This file — current state, all decisions made through Phase 2, exact Phase 3 starting point

**Phase 2 build trail (for deeper context):**
- [`build_phase_reviews/Phase2_Completion.md`](build_phase_reviews/Phase2_Completion.md) — full list of files created/modified in Phase 2
- [`build_phase_reviews/Phase2_Audit_1.md`](build_phase_reviews/Phase2_Audit_1.md) — Phase 2 audit findings (4 real bugs + 1 deferral)
- [`build_phase_reviews/Phase2_Audit_2.md`](build_phase_reviews/Phase2_Audit_2.md) — confirmation that all 4 audit bugs were fixed

---

## 1. Repository state

**GitHub:** https://github.com/msj1542/OrderHub  
**Branch:** `main` (single branch; no PR workflow yet)  
**All commits are pushed to origin.** Confirm with `git status` before starting.

**Commit history (newest first):**
```
e26f241  Add Phase 2 build review docs (completion summary + audit 1 + audit 2)
aa62954  rebuild: Phase 2 audit fixes (data scoping + access control)
3eef9be  Phase 2: Catalog & materials — schema, RLS, browse, admin editor, CSV import/export
17a657f  Expand HANDOFF.md for Phase 1 → 2 handoff; add Phase 1 audit review
8610f28  Phase 1 gap fixes: sign-out, dark mode toggle, UI component set, HANDOFF.md
165fa2c  Replace server-side auth callback with client-side page (implicit flow fix)
ae0df38  Fix auth callback to route invite/recovery to /invite; add resend-invites script
3bbafd2  Phase 1: Auth & identity — schema, RLS, authz module, app shell
d3cd104  Phase 0: foundations — Next.js app, design tokens, Supabase/Drizzle wiring
```

---

## 2. Stack & tooling

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Node runtime, Turbopack dev) |
| Hosting target | Hostinger — GitHub push-deploy (deploy step is a stub; see Deferred) |
| Database | Supabase Postgres via Drizzle ORM (service-role connection) |
| Auth | Supabase Auth — email + password, invite-only |
| File storage | Supabase Storage — `product-files` bucket (private, signed-URL access) |
| Styles | Tailwind v4 + `app/tokens.css` (CSS custom properties, full light+dark) |
| UI primitives | Radix UI (all needed packages installed) + CVA (class-variance-authority) |
| Tests | Vitest 4 + @vitejs/plugin-react |
| Email | `resend` package installed; implementation deferred to Phase 6 |

**Dev commands (run from repo root):**
```bash
npm run dev           # Next.js + Turbopack on :3000
npm test              # vitest (23 tests, all passing as of Phase 2)
npm run lint          # eslint
npm run db:generate   # drizzle-kit generate (after schema.ts changes)
npm run db:migrate    # drizzle-kit migrate (applies pending Drizzle migrations)
npm run db:push       # drizzle-kit push (direct schema push, dev only)
npm run db:studio     # Drizzle Studio UI

# Scripts — always pass --env-file=.env.local
node --env-file=.env.local scripts/bootstrap-admin.mjs    # idempotent initial admin seed
node --env-file=.env.local scripts/resend-invites.mjs     # resend invite/recovery emails
node --env-file=.env.local scripts/check-auth-state.mjs   # list Supabase auth.users
node --env-file=.env.local scripts/check-db.mjs           # list public.users
node --env-file=.env.local scripts/run-migration.mjs <file.sql>  # apply a SQL migration file
node --env-file=.env.local scripts/seed-catalog.mjs       # seed 38 products + prices (idempotent)
node --env-file=.env.local scripts/verify-connection.mjs  # test DB connectivity
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

**Auth users (as of Phase 2):**

| Email | Role | Auth status | Notes |
|---|---|---|---|
| `msj1542@gmail.com` | `internal_admin` | Confirmed, linked | Primary dev/admin account |
| `michael@glasstintusa.com` | `internal_admin` | Invited, linked | Secondary admin; may need re-invite if link expired |

---

## 5. Architecture decisions & deviations

### VERIFY Decision 1 — RLS is defense-in-depth, not primary scoping

**Plan intent:** Drizzle queries run as `authenticated` role with per-request JWT claims; RLS enforces row visibility automatically.

**Actual implementation:** Drizzle uses the **service-role connection** (bypasses RLS entirely). All data scoping is enforced in application code:
- `can(user, action)` for permission checks
- Explicit `WHERE` clauses in every service function for visibility scoping

**Why:** Supabase transaction-mode pooler (port 6543) does not support `SET LOCAL` for per-request JWT claims injection. Session-mode (port 5432) does, but doesn't scale for production.

**Critical implication for every phase:** Every Drizzle query that returns user-scoped data **must** add its own WHERE conditions. RLS protects direct/PostgREST access but is bypassed by all in-app queries. RLS policies are in the migrations and serve as a safety net — not the primary gate.

**Phase 2 fix applied:** `listProducts` now accepts `customerVisibleOnly` flag; `catalog/page.tsx` passes `true` for non-internal users. This was a real scoping bug caught in the Phase 2 audit.

### VERIFY Decision 2 — `auth/callback` is a client page, not a route handler

**Why:** Supabase invite/recovery links use the implicit grant flow — tokens live in the URL hash (`#access_token=…`), which browsers never send to the server.

**File:** `app/auth/callback/page.tsx` — client component that handles all Supabase link types:
- Implicit hash `#access_token=…` (invite, recovery)
- OTP `?token_hash=…&type=…`
- PKCE `?code=…`

`invite` and `recovery` types → `/invite`; everything else → `/dashboard`.

**Stale .next cache note:** `tsc --noEmit` reports one error: `.next/types/validator.ts(161,39): Cannot find module '../../app/auth/callback/route.js'`. This is a stale Next.js generated type from before the callback was converted to a client page. It clears on `rm -rf .next` and does not affect runtime. **This is pre-existing and should be ignored.**

### VERIFY Decision 3 — Drizzle owns table DDL; SQL migration owns RLS + triggers

Drizzle generates table DDL but cannot express RLS policies or triggers. Each migration consists of:
1. **Drizzle** manages schema (types, relations, query builder)
2. **SQL migration files** (`supabase/migrations/`) contain the complete DDL + RLS + triggers + seed data, applied manually via `scripts/run-migration.mjs`

Migrations applied to production:
- `0001_auth_identity.sql` — roles, companies, users, RLS, trigger
- `0002_catalog_materials.sql` — 6 catalog tables, RLS, Storage bucket, seed materials/rolls

### Service-role Supabase clients

Three distinct clients — use the right one for the context:

| Client | File | When to use |
|---|---|---|
| Cookie-based (RLS) | `lib/supabase/server.ts` | RSC, Server Actions, Route Handlers — reads session, respects RLS policies for `storage.*` operations |
| Browser | `lib/supabase/client.ts` | Client components needing real-time or storage from the browser |
| Admin (service-role) | `lib/supabase/admin.ts` | Scripts, Storage uploads/downloads in route handlers, provisioning |

---

## 6. What is built and production-ready (Phases 0–2)

### Phase 0 — Foundations ✅
- Next.js 16 project, manual scaffold (not `create-next-app`)
- `app/tokens.css` — complete design token system: typography, spacing, radii, shadows, layout vars (`--topbar-h: 52px`, `--sidebar-w: 220px`), steel-blue / cool-grey palette, full semantic token set (surface, border, text, brand, status families), light + dark sets
- Tailwind v4 wired with `postcss.config.mjs`; `@` path alias
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- Vitest configured (`vitest.config.ts`)
- GitHub Actions CI (`deploy.yml`) — builds on push; deploy step is a stub

### Phase 1 — Auth & identity ✅

**Database (applied to production Supabase):**
- `supabase/migrations/0001_auth_identity.sql` — `roles`, `companies`, `users` tables; RLS; SECURITY DEFINER helper functions (`is_internal_user()`, `current_app_user_id()`); `handle_auth_user_created` trigger; `updated_at` triggers; 7 roles seeded

**Drizzle schema:** `roles`, `companies`, `users` tables + relations + `AppUser` type

**Auth module (`lib/auth.ts`):**
- `getUser()` — reads Supabase session, joins `public.users`, returns `AppUser | null`; returns null if user is inactive
- `requireUser()` — calls `getUser()`, redirects to `/login` if null
- `getPreviewContext()` — reads `orderhub_preview` cookie
- `assertNotPreview(preview)` — throws if called inside a preview session (use in all write Server Actions)
- `getEffectiveContext(user)` — returns view-as role/company for portal preview overlay

**Authorization (`lib/authz/policy.ts` + `lib/authz/roles.ts`):**
- `can(user, action)` — 28 actions × 7 roles; `internal_admin` implicitly holds all internal actions
- `canAny(user, actions[])` — OR shorthand
- `external pricing:view` automatically checks `user.company.pricingVisible`
- 23 Vitest tests (`lib/authz/policy.test.ts`) — all passing

**7 roles seeded:** `internal_admin`, `order_coordinator`, `fulfillment`, `accounting`, `external_admin`, `external_ordering`, `external_reference`

**Auth flow (invite-only):**
1. Admin creates `public.users` row (email, name, role_code, company_id)
2. `scripts/bootstrap-admin.mjs` or future internal admin UI sends Supabase invite
3. Supabase trigger auto-links `auth.users` → `public.users` by email on first sign-in
4. User clicks invite email → `app/auth/callback/page.tsx` → `/invite` → set name+password → `/dashboard`

**App shell:**
- `app/(app)/layout.tsx` — RSC; `requireUser()` + `getPreviewContext()`; renders Sidebar + Topbar + `<main>`
- `components/layout/sidebar.tsx` — client; role-based nav; sign-out button; preview banner slot
- `components/layout/topbar.tsx` — client; pathname-based page title; ThemeToggle; notifications bell
- `components/layout/preview-banner.tsx` — client; exit-preview form action
- `app/(app)/actions.ts` — `exitPreviewAction`, `signOutAction`
- Dark mode: flash-prevention `<script>` in root `<head>`; `ThemeToggle` persists to `localStorage`; `@media` + `data-theme` double coverage

### Phase 2 — Catalog & materials ✅ (including audit fixes)

**Database (applied to production Supabase):**
- `supabase/migrations/0002_catalog_materials.sql` — 6 new tables, full RLS, Storage bucket `product-files`, seed: Gloss PPF + Matte PPF materials, 3 roll widths (exact costs from reference)
- Seed applied: 38 Harley Davidson products, 76 price rows (from reference CSVs)

**6 new Drizzle tables:**
- `materials` — film types (code, name, isActive)
- `material_roll_widths` — width/length/rollCost/handlingCost per material
- `products` — PPF kits; key fields: `sku`, `brand`, `model`, `yearStart`, `partName`, `attr1`, `attr2`, `description`, `patternLengthIn`, `requiredRollWidthIn`, `isActive`, `customerVisible`, `thumbnailPath`, `thumbnailFileId` (in memory, not DB — see type below)
- `product_materials` — many-to-many join (productId, materialId)
- `prices` — `unit_price` as `numeric(12,2)`; `isActive` flag; upsert deactivates prior prices first
- `product_files` — label, filePath (Storage path), mimeType, isThumbnail, sortOrder

**Key schema types (`lib/db/schema.ts`):**
- `AppUser = User & { role: Role; company: Company | null }` — the core user type used everywhere
- `MaterialWithRolls = Material & { rolls: MaterialRollWidth[] }`
- `ProductWithMaterials = Product & { materials: MaterialWithRolls[]; prices: Price[]; thumbnailFileId: string | null }` — used for list/browse context; `thumbnailFileId` is populated by `hydrateProducts()` via a 5th parallel query
- `ProductFull = ProductWithMaterials & { files: ProductFile[] }` — used for admin product editor (full detail)

**Service layer (`lib/catalog/service.ts`):**
- `listMaterials()` — all materials with rolls
- `listProducts(filters)` — filters: `query` (ilike), `includeInactive`, `customerVisibleOnly`; calls `hydrateProducts()` internally
- `getProduct(id)` → `ProductFull` (includes files)
- `createProduct()`, `updateProduct()`, `setProductMaterials()`, `upsertPrice()`, `addProductFile()`, `setProductThumbnail()`
- `hydrateProducts()` — internal; 5 parallel queries (`Promise.all`): product_materials, materials, roll_widths, active prices, thumbnail file IDs

**Data scoping rules (enforced in service/route code):**
- `listProducts({ includeInactive: false, customerVisibleOnly: true })` for external users
- `/api/product-files/[id]` joins products table; returns 404 if product is inactive or `!customerVisible` for external users

**CSV import/export:**
- `lib/catalog/csv.ts` — RFC 4180 parser, `ImportReport` type, `validateProductImport()`, `validatePricingImport()`, `productRowToValues()`
- Two import types: product catalog (DocTitle=SKU, BrandName, ModelName, PartName, Width=patternLength, Height=requiredRollWidth) and pricing catalog (SKU, GlossPrice, MattePrice, EffectiveDate, PriceListRevision)
- Validate-then-apply flow: `previewImportAction()` returns `ImportReport` (no DB writes); `applyImportAction()` blocks on duplicates/invalids/unmatched before writing
- Export: `GET /api/catalog/export` — pricing CSV format (SKU, GlossPrice, MattePrice, EffectiveDate, PriceListRevision, Active); internal + `pricing:view` only

**Money utility (`lib/pricing/money.ts`):**
- `formatMoney(amount)` — `Intl.NumberFormat` USD; returns "—" for null/invalid
- `parseMoney(str)` — strips non-numeric, returns number
- `toDecimal(amount)` — rounds to 2dp string for `numeric(12,2)` columns
- `addMoney(a, b)` — cents-based float-safe addition

**Settings routing:**
- `app/(app)/settings/layout.tsx` — settings shell; requires `settings:manage` permission; renders `SettingsNav`
- `components/layout/settings-nav.tsx` — 7 tabs: Companies, Team, Catalog, Materials, Resources, Operations, Audit (each filtered by `can()`)
- `app/(app)/settings/catalog/page.tsx` + `actions.ts` — CatalogManager (admin product list + tabs)
- `app/(app)/settings/materials/page.tsx` + `actions.ts` — MaterialSettingsPanel (material + roll editor)
- `app/(app)/settings/[section]/page.tsx` — catch-all for remaining tabs (companies, team, resources, operations, audit); `catalog` and `materials` have dedicated pages that take precedence

**UI components added in Phase 2:**
- `components/ui/alert.tsx` — info/success/warning/danger variants; Lucide icons
- `components/ui/field-hint.tsx` — Radix Tooltip wrapping HelpCircle icon; inline next to labels
- `components/ui/data-table.tsx` — generic `DataTable<T>` with `Column<T>[]` config; client-side sort via `sortValue?: (row: T) => string | number` accessor; expandable rows via `expandedContent`; `emptyState` slot
- `components/catalog/catalog-browse.tsx` — client island; client-side search; uses DataTable
- `components/catalog/product-details.tsx` — specs grid, pricing section, files list, thumbnail image
- `components/catalog/catalog-manager.tsx` — admin product list + Radix Tabs (Product Editor | CSV Import)
- `components/catalog/product-editor.tsx` — full product form: `useActionState(saveProductAction)`; material checkboxes + price inputs; file upload
- `components/catalog/csv-import.tsx` — type selector + file input + validate+apply forms; `ReportView`
- `components/catalog/material-settings.tsx` — material list + RollEditor + AddRollForm (all `useActionState`-based)

**API routes:**
- `GET /api/catalog/export` — CSV export; authenticated, requires `pricing:view`
- `GET /api/product-files/[id]` — signed-URL redirect (60s TTL); joins products table to enforce visibility before generating URL

---

## 7. UI component library (full inventory)

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

**Still needed for Phase 3+:**
- `ConfirmDialog` — wraps Dialog; for destructive order actions (Phase 3)
- `Toggle` — settings boolean switch, distinct from Checkbox (Phase 6)
- `Timeline` — audit history list (Phase 6)
- `MasterDetail` — shared layout primitive for list+detail pattern (Phase 3)
- `FormGrid` — consistent form layout (Phase 6)

---

## 8. Test infrastructure

**Runner:** Vitest 4 (`npm test`)  
**Config:** `vitest.config.ts` with `@vitejs/plugin-react`, `@` path alias

**Test file:** `lib/authz/policy.test.ts`  
**Results:** 23/23 passing (as of Phase 2 audit fixes commit `aa62954`)

**What the tests cover:**
- `can(user, action)` for all 7 roles × 28 actions
- `internal_admin` inherits all internal actions
- `external pricing:view` respects `company.pricingVisible`
- `canAny()` OR shorthand

**What Phase 3 should add (per REBUILD_PLAN.md):**
- Order status machine state transitions (valid → invalid combos)
- Duplicate-PO detection (window-based)
- Invoice verification rules
- Schedule computation (cutoff/completion weekday+time)

---

## 9. Deferred items (carry into Phase 3+)

### From Phase 2 audit — acceptable deferrals (not bugs)

| Item | Notes |
|---|---|
| CSV import field-level diff | Preview shows which SKUs change but not which fields. Requires fetching current DB values during preview. Defer until catalog management is actively used. |
| Server-side catalog search/pagination | Currently loads all 38 products client-side. Fine for current catalog size. Add server-side filtering when catalog grows or performance is an issue. |
| RLS `product_files_select_authenticated` uses `USING(true)` | DB-layer policy doesn't join to `products.customer_visible`. RLS is defense-in-depth only (service-role bypasses it). The download route enforces visibility correctly. Acceptable — the route is the primary gate. |

### From Phase 1 — still open

| Item | Target phase |
|---|---|
| Transactional email (Resend) — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `lib/notifications/` | Phase 6 |
| GitHub Actions deploy step (Hostinger SSH, `serverActions.allowedOrigins` for production domain) | Pre-go-live |
| Portal preview modal (admin sees what a customer sees) | Phase 6 |
| `BUSINESS_TIMEZONE` usage — `lib/settings/tz.ts` and `computeExpectedCompletion()` | Phase 3 (schedule settings) |
| Reminder/escalation scheduler (pg_cron) | Deferred indefinitely — needs product definition |
| M365 / Entra ID SSO | Post-MVP |

---

## 10. Phase 3 — Ordering core

### What Phase 3 builds (from REBUILD_PLAN.md)

> **Phase 3 — Ordering core.** Order schema, New Order builder (search, lines, custom item,
> expedited), `submitOrder()` + duplicate-PO service, draft/submit, orders workspace + detail,
> comments/notes, money util.

### New schema (new migration file: `0003_orders.sql`)

**`orders`**
- `id`, `order_number` (auto-increment or UUID-based display), `company_id` (→ companies), `created_by_user_id` (→ users), `status` (enum: draft|submitted|accepted|in_fulfillment|fulfillment_completed|ready_for_pickup|released|invoiced|closed|canceled), `is_expedited` (boolean), `requested_date` (date, expedited only), `po_number` (text, duplicate-check window), `notes` (internal notes text), `created_at`, `updated_at`

**`order_lines`**
- `id`, `order_id`, `product_id`, `material_id`, `quantity`, `unit_price` (`numeric(12,2)`), `line_total`, `is_custom_item` (boolean), `custom_description` (for custom items), `created_at`

**`order_comments`**
- `id`, `order_id`, `user_id`, `body`, `is_internal` (boolean — internal notes vs customer-visible), `created_at`

**`cancellation_requests`**
- `id`, `order_id`, `requested_by_user_id`, `reason`, `status` (pending|approved|declined), `resolved_by_user_id`, `resolved_at`, `created_at`

### Status machine
Order statuses: `draft → submitted → accepted → in_fulfillment → fulfillment_completed → ready_for_pickup → released → invoiced/closed`, with `canceled` reachable from `submitted`/`accepted`.

All transitions must be:
- **Transactional** — single Postgres transaction (fixes reference app's non-atomic multi-statement writes)
- **Role-gated** via `can(user, action)` BEFORE the DB write
- **State-validated** — only valid from/to combos are accepted; invalid transitions return an error

Reference for exact role/status guards: `original-reference/app/api/orders/[id]/action/route.ts`

### Key service actions to implement (`lib/orders/service.ts`)
- `createDraft(userId, companyId)` → order
- `submitOrder(orderId, userId)` — runs duplicate-PO check first; uses `lib/orders/duplicate.ts`
- `acceptOrder(orderId, userId)` — creates `production_work_orders` row (Phase 4)
- `addOrderLine(orderId, { productId, materialId, qty, unitPrice })` 
- `addComment(orderId, userId, body, isInternal)`
- `requestCancellation(orderId, userId, reason)`

### Duplicate-PO service (`lib/orders/duplicate.ts`)
Block re-submission of the same PO number within a configurable window (reference default: 180 days). Check runs at `submit` time, not at draft creation.

### New Order builder UX
Reference: `original-reference/app/ordering-hub-app.tsx` → `NewOrderView` component
- Catalog search (by brand/model/part) → add line items
- Custom item form (description + price — not catalog SKU)
- Expedited toggle → requested date picker
- Draft save vs. submit
- Reorder mode (pre-fills from existing order)
- Supplemental order mode (linked to a parent order)

### Orders workspace
Reference: `original-reference/app/ordering-hub-app.tsx` → `OrdersWorkspace` + `OrderDetail`
- List + detail (scope tabs per role: own / company / all)
- Comment thread (customer-visible vs internal)
- Status action bar

### RLS for order tables
- External users see only their own orders (or company's, per `company.order_scope`)
- Internal users see all orders
- Comments with `is_internal=true` are never visible to external users
- Since Drizzle uses service-role: **app code must enforce all scoping via WHERE clauses**

### Reference files to read before building
All read-only; never edit:
```
original-reference path:
C:\Users\mjager\Documents\Codex\2026-07-29\ordering-hub-sites-project-appgprj-6a6a8e869e3081918c3c61a26d78c2d8-2\work\site\

Key files for Phase 3:
  db/schema.ts                              — reference orders/order_items/comments schema
  app/ordering-hub-app.tsx                  — NewOrderView, OrdersWorkspace, OrderDetail UI
  app/api/orders/route.ts                   — order creation API
  app/api/orders/[id]/action/route.ts       — all status transitions + guards
  lib/auth.ts                               — requireAppUser, isInternal helpers
  lib/bootstrap.ts                          — loadApplication, computeExpectedCompletion
```

### Components to build in Phase 3

| Component | File | What it is |
|---|---|---|
| New Order builder | `components/orders/new-order.tsx` | Full order entry form (catalog search, lines, custom item, expedited) |
| Orders workspace | `components/orders/orders-workspace.tsx` | List + scope tabs + filter |
| Order detail | `components/orders/order-detail.tsx` | Summary, lines, comment thread, action bar |
| Order action bar | `components/orders/order-actions.tsx` | Accept/submit/cancel buttons, status-machine gated |
| Comment composer | `components/orders/comment-composer.tsx` | Internal vs customer-visible toggle |
| ConfirmDialog | `components/ui/confirm-dialog.tsx` | Shared for destructive actions |
| MasterDetail | `components/ui/master-detail.tsx` | Reusable list+detail layout |

### New pages in Phase 3

| Route | Type | What it does |
|---|---|---|
| `app/(app)/orders/page.tsx` | RSC | Orders workspace (replace placeholder) |
| `app/(app)/orders/new/page.tsx` | RSC | New Order builder (replace placeholder) |

### Tests to add in Phase 3

Per REBUILD_PLAN.md, Vitest tests should cover:
- Order status machine: valid and invalid transitions per role
- Duplicate-PO detection: within window, outside window, same PO different company
- Invoice verification rules (Phase 5, but schema decisions affect Phase 3)
- Schedule computation (expected completion from cutoff/completion settings)

---

## 11. Full file structure (as of Phase 2 completion)

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
    dashboard/page.tsx                  # placeholder
    orders/page.tsx                     # placeholder → Phase 3 target
    orders/new/page.tsx                 # placeholder → Phase 3 target
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
    data-table.tsx                      # generic sortable + expandable rows
    dialog.tsx                          # Radix Dialog
    empty-state.tsx                     # icon + title + description + action
    field-hint.tsx                      # Radix Tooltip + HelpCircle icon
    input.tsx                           # token-styled input
    label.tsx                           # Radix Label
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

lib/
  auth.ts                               # getUser, requireUser, preview helpers
  authz/
    policy.ts                           # can(), canAny(), Action type, 28 actions × 7 roles
    roles.ts                            # ROLES enum, RoleCode type
    policy.test.ts                      # 23 vitest tests — all passing
  catalog/
    csv.ts                              # parseCsv, ImportReport, validateProductImport, validatePricingImport, productRowToValues
    service.ts                          # listMaterials, listProducts, getProduct, CRUD + hydrateProducts
  db/
    schema.ts                           # Drizzle: all tables + relations + composite types
    index.ts                            # Drizzle client (service-role, transaction-mode pooler)
  hooks/
    use-toast.ts                        # toast(), dismiss(), useToast()
  pricing/
    money.ts                            # formatMoney, parseMoney, toDecimal, addMoney
  supabase/
    admin.ts                            # createAdminClient() — service-role, scripts/routes
    client.ts                           # createClient() — browser components
    server.ts                           # createClient() — RSC, Server Actions, Route Handlers
  utils.ts                              # cn()

scripts/
  bootstrap-admin.mjs                   # one-time initial admin seed + Supabase invite
  check-auth-state.mjs                  # list Supabase auth.users
  check-db.mjs                          # list public.users
  resend-invites.mjs                    # resend recovery/invite emails
  run-migration.mjs                     # apply a SQL migration file: node ... <file.sql>
  seed-catalog.mjs                      # seed 38 products + 76 price rows (idempotent)
  verify-connection.mjs                 # test DB connectivity

supabase/
  migrations/
    0001_auth_identity.sql              # roles/companies/users + RLS + trigger + seed
    0002_catalog_materials.sql          # 6 catalog tables + RLS + Storage + seed

.github/workflows/deploy.yml           # CI: npm ci + db:migrate + build; deploy = stub
drizzle.config.ts
next.config.ts                          # serverActions.allowedOrigins: ["localhost:3000"]
vitest.config.ts
REBUILD_PLAN.md                         # full product spec — read this first
CLAUDE.md                               # repo + reference app instructions
HANDOFF.md                              # Phase 1 → 2 handoff (now superseded by this file)
HANDOFF_Phase2-3.md                     # this file
build_phase_reviews/
  Phase1_Audit_1.md                     # Phase 1 gap audit findings
  Phase2_Completion.md                  # Phase 2 files built + checks passed
  Phase2_Audit_1.md                     # Phase 2 audit: 4 bugs + 1 deferral found
  Phase2_Audit_2.md                     # Phase 2 audit: confirmation of 4 fixes applied
```

---

## 12. Running the app locally

```bash
# 1. Install (skip if node_modules present)
npm ci

# 2. Start dev server
npm run dev   # → http://localhost:3000

# 3. Sign in
# Use msj1542@gmail.com. If the Supabase session has expired, sign in at /login.
# If login fails (account not set up), run:
node --env-file=.env.local scripts/resend-invites.mjs
# Click the link → /auth/callback → /invite → set name+password → /dashboard

# 4. Run tests
npm test   # should be 23/23
```

---

## 13. Known TypeScript issue (pre-existing, non-blocking)

`tsc --noEmit` reports one error on every run:
```
.next/types/validator.ts(161,39): error TS2307: 
  Cannot find module '../../app/auth/callback/route.js'
```

This is stale Next.js auto-generated types from before `auth/callback` was converted from a route handler to a client page (Phase 1 fix). It does **not** affect runtime. Clears with `rm -rf .next`. **Ignore this error; treat zero other errors as the passing bar.**
