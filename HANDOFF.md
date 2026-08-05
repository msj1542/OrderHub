# OrderHub — Phase 1 → Phase 2 Handoff

This document is the single source of context for a new conversation picking up at
Phase 2. It contains everything not already in `REBUILD_PLAN.md` or `CLAUDE.md`.
**Read `REBUILD_PLAN.md` and `CLAUDE.md` first**, then use this file to understand
current state, decisions made, and exactly where to start.

The detailed audit trail for Phase 1 gaps and fixes is in
`build_phase_reviews/Phase1_Audit_Review.md`.

---

## 1. Git & repo state

**GitHub repo:** https://github.com/msj1542/OrderHub  
**Branch:** `main` (only branch; PRs not used yet)

**Commit history (newest first):**
```
8610f28  Phase 1 gap fixes: sign-out, dark mode toggle, UI component set, HANDOFF.md
165fa2c  Replace server-side auth callback with client-side page (implicit flow fix)
ae0df38  Fix auth callback to route invite/recovery to /invite; add resend-invites script
3bbafd2  Phase 1: Auth & identity — schema, RLS, authz module, app shell
d3cd104  Phase 0: foundations — Next.js app, design tokens, Supabase/Drizzle wiring
bef6c4a  Initial commit: add CLAUDE.md with reference app documentation
```

> **⚠ `8610f28` may not be pushed yet.** Run `git push` before starting Phase 2
> and confirm the remote is up to date.

**Untracked (intentionally not committed):**
- `.env.local` — secrets; see Section 4 for var names
- `build_phase_reviews/` — audit review summaries (add to `.gitignore` or commit as desired)

---

## 2. Stack & tooling

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Node runtime, Turbopack dev) |
| Hosting target | Hostinger — GitHub push-deploy (deploy step not yet wired; see Deferred) |
| Database | Supabase Postgres via Drizzle ORM |
| Auth | Supabase Auth — email + password, invite-only |
| File storage | Supabase Storage (signed URLs) — not yet used; Phase 2 adds product files |
| Styles | Tailwind v4 + `app/tokens.css` (CSS custom properties) |
| UI primitives | Radix UI (all needed packages already installed) |
| Tests | Vitest 4 + @vitejs/plugin-react |
| Email | `resend` package installed; module deferred to Phase 6 |

**Dev commands (run from repo root):**
```bash
npm run dev          # Next.js dev server with Turbopack on :3000
npm test             # vitest run (23 tests, all passing)
npm run lint         # eslint
npm run db:generate  # drizzle-kit generate (after schema changes)
npm run db:migrate   # drizzle-kit migrate (applies pending migrations)
npm run db:push      # drizzle-kit push (direct schema push, dev only)
npm run db:studio    # Drizzle Studio UI

node --env-file=.env.local scripts/bootstrap-admin.mjs   # idempotent initial admin seed
node --env-file=.env.local scripts/resend-invites.mjs    # resend invite/recovery emails
node --env-file=.env.local scripts/check-auth-state.mjs  # inspect Supabase auth users
node --env-file=.env.local scripts/check-db.mjs          # inspect public.users
```

---

## 3. What is built (Phases 0–1)

### Phase 0 — Foundations ✅
- Next.js 16 project scaffolded (no `create-next-app`; done manually)
- `app/tokens.css` — complete design token system: typography, spacing, radii, shadows,
  layout vars (`--topbar-h: 52px`, `--sidebar-w: 220px`), steel-blue / cool-grey palette,
  semantic surface/border/text/brand/accent/status tokens, full light + dark sets
  (`@media prefers-color-scheme` + `:root[data-theme]` override for the manual toggle)
- Tailwind v4 wired with `postcss.config.mjs`
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- Supabase project created, `.env.local` wired
- Drizzle ORM configured (`drizzle.config.ts`, `lib/db/index.ts`)
- Vitest configured (`vitest.config.ts` with `@` path alias)
- GitHub Actions workflow (`.github/workflows/deploy.yml`) — builds on push to main;
  **deploy step is a stub** (see Deferred)

### Phase 1 — Auth & identity ✅
**Database (all applied to production Supabase):**
- `supabase/migrations/0001_auth_identity.sql` — creates `roles`, `companies`, `users`
  tables; RLS enabled on all three; SECURITY DEFINER helper functions
  (`current_app_user_id()`, `is_internal_user()`, etc.); RLS policies (role-family scoping);
  `handle_auth_user_created` trigger (links `auth.users` INSERT → `public.users` by email
  at invite time); `updated_at` triggers; 7 roles seeded.

**Drizzle schema (`lib/db/schema.ts`):** `roles`, `companies`, `users` tables + relations +
`AppUser` type (User joined with Role + Company).

**Auth module (`lib/auth.ts`):**
- `getUser()` — reads Supabase session, joins `public.users`, returns `AppUser | null`
- `requireUser()` — calls `getUser()`, redirects to `/login` if null
- `getPreviewContext()` — reads `orderhub_preview` cookie
- `assertNotPreview()` — throws if called inside a preview session
- `getEffectiveContext()` — returns view-as role/company for preview overlay

**Authorization (`lib/authz/policy.ts` + `lib/authz/roles.ts`):**
- `can(user, action)` — single role×action matrix, 28 actions across 7 roles
- `canAny(user, actions[])` — OR shorthand
- `external pricing:view` checks `company.pricingVisible` automatically
- 23 Vitest tests covering all roles (`lib/authz/policy.test.ts`)

**Auth pages:**
- `app/(auth)/login/page.tsx` + `actions.ts` — email+password login via Supabase
- `app/(auth)/invite/page.tsx` + `actions.ts` — set display name + password on first
  login; `acceptInviteAction` calls `supabase.auth.updateUser({ password })` and updates
  `public.users.name`
- `app/auth/callback/page.tsx` — **client component** (not route handler); handles all
  three Supabase link formats: implicit hash (`#access_token=…`), OTP token_hash, PKCE code;
  `invite` and `recovery` types → `/invite`; everything else → `/dashboard`

**App shell:**
- `app/(app)/layout.tsx` — RSC; calls `requireUser()` + `getPreviewContext()`;
  passes `signOutAction` to Sidebar; renders `<Sidebar>`, `<Topbar>`, `<main>`
- `components/layout/sidebar.tsx` — client; role-based nav via `can()`; preview banner slot;
  sign-out button (LogOut icon → `signOutAction` server form)
- `components/layout/topbar.tsx` — client; page title from pathname; `ThemeToggle`;
  notifications bell link; user avatar/initials
- `components/layout/preview-banner.tsx` — warning strip; exit-preview form action
- `app/(app)/actions.ts` — `exitPreviewAction`, `signOutAction`

**UI components built (`components/ui/`):**
| File | What it is |
|---|---|
| `button.tsx` | CVA button — primary / secondary / danger / success / ghost / link × md / sm |
| `input.tsx` | Styled `<input>` with token ring |
| `label.tsx` | Radix Label wrapper |
| `status-pill.tsx` | StatusPill + `ORDER_STATUS_FAMILY` map (7 status families) |
| `badge.tsx` | CVA badge — default / neutral / info / success / warning / danger / urgent / completed |
| `checkbox.tsx` | Radix Checkbox wrapper |
| `dialog.tsx` | Radix Dialog — DialogContent / Header / Footer / Title / Description |
| `empty-state.tsx` | Centered icon + title + description + optional action |
| `select.tsx` | Radix Select — Trigger / Content / Item / Label / Separator |
| `tabs.tsx` | Radix Tabs — List / Trigger / Content (underline style) |
| `textarea.tsx` | Styled `<textarea>` |
| `theme-toggle.tsx` | Moon/Sun toggle; reads/writes `localStorage.theme`; sets `data-theme` on `<html>` |
| `toaster.tsx` | Radix Toast viewport + renders active toasts (default / success / danger) |

**Toast system (`lib/hooks/use-toast.ts`):**
- Module-level store — call `toast({ title, description, variant })` from anywhere
- `useToast()` hook for the Toaster component
- `dismiss(id)` to remove early
- `Toaster` is in `app/layout.tsx` (root layout)

**Dark mode:**
- Flash-prevention inline `<script>` in root `<head>` applies saved theme before paint
- Toggle in topbar; persists to `localStorage`; OS preference honoured via `@media` fallback
- `:root[data-theme="dark"|"light"]` overrides in `tokens.css`

**Placeholder app pages (all redirect-guarded, no content yet):**
`/dashboard`, `/orders`, `/orders/new`, `/production`, `/catalog`, `/resources`,
`/notifications`, `/company-users`, `/settings/[section]`

**Scripts:**
- `scripts/bootstrap-admin.mjs` — creates `public.users` row + sends Supabase invite; idempotent
- `scripts/resend-invites.mjs` — sends recovery email to confirmed users; creates row + sends
  fresh invite for new users
- `scripts/check-auth-state.mjs` — lists all Supabase auth users + confirmed/sign-in timestamps
- `scripts/check-db.mjs` — lists roles + public.users rows

---

## 4. Environment variables

All vars live in `.env.local` (gitignored). **Never commit this file.**
Add production values as GitHub Actions secrets for the deploy workflow.

| Variable | Purpose | Required in |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key — `sb_publishable_…` format | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — `sb_secret_…` format; bypasses RLS | Server only |
| `DATABASE_URL` | Postgres connection string — **transaction-mode pooler** (port 6543) | Server (Drizzle) |
| `INITIAL_ADMIN_EMAIL` | Email of the first internal_admin (used by bootstrap script) | Scripts only |
| `BUSINESS_TIMEZONE` | IANA timezone string for schedule computations (`America/Chicago`) | Server |
| `NEXT_PUBLIC_APP_URL` | Full app URL for invite redirect links (default: `http://localhost:3000`) | Scripts |

**Not yet needed (add in Phase 6):**
- `RESEND_API_KEY` — Resend transactional email
- `RESEND_FROM_EMAIL` — From address for outbound emails

---

## 5. Supabase project

**Project ID:** `biiqvnqesatnrnawxeki`  
**Region:** `aws-1-us-west-2`  
**Pooler:** Transaction-mode (port 6543) — used in `DATABASE_URL`  
**Key format:** New Supabase format (`sb_publishable_…` / `sb_secret_…`) — works with
`@supabase/ssr` and `@supabase/supabase-js` without any code changes.

**Auth users (as of Phase 1 completion):**

| Email | Role | Auth status | Notes |
|---|---|---|---|
| `msj1542@gmail.com` | `internal_admin` | Confirmed, linked | Email confirmed; recovery email sent so user can set name+password via `/invite` |
| `michael@glasstintusa.com` | `internal_admin` | Invited, linked | Invite email sent; needs to click link → `/invite` to set up account |

**Auth flow for new users (invite-only):**
1. Admin creates `public.users` row (email, name, role_code)
2. Call `admin.auth.admin.inviteUserByEmail(email, { redirectTo: APP_URL + '/auth/callback?type=invite' })`
3. Supabase trigger `handle_auth_user_created` auto-links the new `auth.users` row to `public.users` by email
4. User clicks invite email → `app/auth/callback/page.tsx` reads hash fragment → `setSession()` → redirects to `/invite`
5. User sets display name + password → `acceptInviteAction` → `/dashboard`

---

## 6. Architecture decisions & deviations

### RLS is defense-in-depth, not primary scoping
**Plan:** Drizzle queries run as `authenticated` role with per-request JWT claims → RLS
enforces row scoping automatically.

**Actual:** Drizzle uses the **service-role connection** (bypasses RLS). Scoping is enforced
in app code: `can()` for action checks, explicit `WHERE` filters per route.

**Why:** Supabase transaction-mode pooler (port 6543) doesn't support `SET LOCAL` for
per-request JWT claims injection. Session-mode (port 5432) does, but doesn't scale.

**Implication for Phase 2+:** Every Drizzle query that returns user-scoped data **must**
include an explicit `WHERE` clause. Do not rely on the DB to enforce it. RLS policies do
protect direct / PostgREST access.

**Resolution path:** Evaluate session-mode pooler or PostgREST reads in a future phase.

### `auth/callback` is a client page, not a route handler
**Why:** Supabase email links (invite + password reset) use the implicit grant flow — tokens
in the URL hash fragment, which is browser-only and never sent to the server.

**Handled formats (in order):** implicit hash `#access_token=…`, OTP `?token_hash=…&type=…`,
PKCE `?code=…`. `invite` and `recovery` types → `/invite`; everything else → `/dashboard`.

### Drizzle owns schema; SQL migration owns RLS + triggers
Drizzle generates the table DDL but cannot express RLS policies or triggers. The migration
file (`supabase/migrations/0001_auth_identity.sql`) contains the full SQL for both and was
applied manually via `node --env-file=.env.local scripts/run-migration.mjs` (a one-time
runner; not a recurring script). Future migrations follow the same pattern.

---

## 7. Deferred items (carry into Phase 2+)

### Transactional email — Resend (→ Phase 6)
`resend` package is installed. No `lib/notifications/` module yet.  
**Phase 6 work:** `lib/notifications/email.ts` (send helper), `lib/notifications/service.ts`
(in-app fan-out), add `RESEND_API_KEY` + `RESEND_FROM_EMAIL` to env + GitHub secrets.

### GitHub Actions deploy step (→ pre-go-live)
`.github/workflows/deploy.yml` runs `npm ci` + `npm run db:migrate` + `npm run build` on
push to main. The "Deploy to Hostinger" step echoes a TODO.  
**To complete:** Wire Hostinger SSH key, add `next.config.ts` production domain to
`serverActions.allowedOrigins`.

### Remaining UI components (→ as needed)
| Component | Needed in |
|---|---|
| `DataTable + ExpandableRow` | Phase 2 (catalog browse) |
| `Alert` | Phase 2 (form errors, CSV import warnings) |
| `ConfirmDialog` | Phase 3 (destructive order actions) |
| `Toggle` | Phase 6 (settings booleans) |
| `Timeline` | Phase 6 (audit history) |
| `MasterDetail` | Phase 3 (order workspace layout) |
| `FieldHint / Tooltip` | Phase 2+ (form guidance) |
| `FormGrid` | Phase 6 (settings forms) |

### Fulfillment role + Orders nav (decided, documented)
Fulfillment-only users see Production only. Users needing both use `internal_admin` or
`order_coordinator`. No multi-role system planned.

---

## 8. What is production-ready after Phase 1

- **Auth** — email+password login, invite flow, recovery (password reset), sign-out,
  auth guard (`requireUser()`)
- **App shell** — RSC layout, role-based sidebar nav, topbar, dark mode toggle, preview mode
  (cookie-based, server-enforced read-only)
- **DB foundation** — `roles`, `companies`, `users` tables with RLS, seed (7 roles),
  trigger-based profile linking
- **Authorization** — `can(user, action)` matrix, 28 actions, 7 roles, 23 unit tests passing
- **Design system** — full token set (light+dark), 13 UI components built

---

## 9. Phase 2 entry point — Catalog & materials

### What Phase 2 builds
From `REBUILD_PLAN.md`:
> **Phase 2 — Catalog & materials.** products / materials / rolls / prices + RLS,
> CSV import (preview + apply) & export, catalog browse + detail, admin catalog /
> material editors, product files / thumbnails via Storage. *(Upstream of ordering.)*

### Schema to add (`lib/db/schema.ts` + new migration)

These tables match the reference app's `db/schema.ts`. Column names to use:

**`products`** — PPF kits identified by brand/model/year/part:
- `id`, `sku` (unique), `brand`, `model`, `year_start`, `year_end`, `part_name`,
  `part_number`, `required_roll_width_in` (decimal), `pattern_length_in` (decimal),
  `notes`, `is_active`, `thumbnail_path` (Storage), `created_at`, `updated_at`

**`materials`** — film types (Gloss, Matte, etc.):
- `id`, `name`, `description`, `is_active`, `created_at`, `updated_at`

**`material_roll_widths`** — available widths per material:
- `id`, `material_id` (→ materials), `width_in` (decimal), `is_active`

**`product_materials`** — which materials a product can be cut from:
- `product_id`, `material_id` (composite PK)

**`prices`** — per product × material (company-tier pricing comes later):
- `id`, `product_id`, `material_id`, `unit_price` (`numeric(12,2)`), `effective_date`,
  `created_at`

**`product_files`** — install instructions, diagrams, images:
- `id`, `product_id`, `label`, `file_path` (Storage), `mime_type`, `sort_order`,
  `created_at`

> **Reference app field name fix (audit issue #14):** The reference uses `products.height`
> to mean "required roll width." The rebuild uses `required_roll_width_in` and
> `pattern_length_in`. Keep these names.

> **Money:** all price columns are `numeric(12,2)`. Use `lib/pricing/money.ts` (to be
> created in Phase 2) for formatting and arithmetic — no raw floats.

### RLS for catalog tables
- `products`, `materials`, `material_roll_widths`, `product_files`, `prices`: all
  authenticated users can `SELECT`; only internal users (`is_internal_user()`) can
  `INSERT/UPDATE/DELETE`. Pricing rows: only visible to users where pricing is visible
  (internal always; external per `company.pricing_visible`). Enforce via `can(user, 'pricing:view')` in app code + an RLS policy on `prices`.

### Supabase Storage — new bucket for Phase 2
Create a bucket `product-files` for thumbnails and product documents. Access policy:
authenticated users can read; service-role can write. Signed URLs for downloads
(via `supabase.storage.from('product-files').createSignedUrl(path, 3600)`).

### Routes and pages to build

| Route | Type | What it does |
|---|---|---|
| `app/(app)/catalog/page.tsx` | RSC | Product browse table; search + filter by brand/material; `DataTable` + `ExpandableRow`; conditionally shows pricing column (`can(user, 'pricing:view')`) |
| `app/(app)/catalog/[id]/page.tsx` | RSC | Product detail — specs, compatible materials, pricing (if visible), files/download links |
| `app/(app)/settings/catalog/page.tsx` | RSC+client | Catalog manager — product list + "New Product" button; gated by `can(user, 'catalog:manage')` |
| `app/(app)/settings/catalog/[id]/page.tsx` | RSC+client | Product editor — all fields, material assignments, pricing rows, file upload, thumbnail |
| `app/(app)/settings/materials/page.tsx` | RSC+client | Material settings — list + editor + roll widths; gated by `can(user, 'materials:manage')` |
| `app/api/catalog/export/route.ts` | Route Handler | CSV export of full catalog; authenticated, internal only |

**CSV import flow** (`can(user, 'catalog:manage')`):
1. Upload CSV → parse + validate (preview with row count, error list)
2. Show diff table (new / updated / unchanged rows)
3. Confirm → apply (upsert by SKU)

See `original-reference/` for the exact CSV column headers and the import logic in
`lib/catalog/import.ts` (reference). Reproduce behavior faithfully.

### Components to build in Phase 2
- `DataTable` + `ExpandableRow` — sortable, filterable; check reference for column definitions
- `Alert` — inline error/warning/info strip (for CSV import validation messages)
- Product file upload widget (wraps Supabase Storage upload)
- CSV import flow UI (upload → preview → confirm)

### Service layer
Create `lib/catalog/` with:
- `service.ts` — `listProducts(filters)`, `getProduct(id)`, `createProduct()`, `updateProduct()`, `deleteProduct()` (soft-delete via `is_active`)
- `csv.ts` — CSV parse, validate, diff, import helpers
- Create `lib/pricing/money.ts` — `formatMoney(cents)`, `parseMoney(str)`, numeric helpers

### Key reference files to read before building
All read-only; never edit:
```
C:\Users\mjager\Documents\Codex\2026-07-29\ordering-hub-sites-project-appgprj-6a6a8e869e3081918c3c61a26d78c2d8-2\work\site\
  db/schema.ts              — reference column names, constraints
  app/ordering-hub-app.tsx  — reference UI (ProductCatalog, ProductDetails, CatalogManager, ProductEditor)
  app/api/                  — reference API routes for catalog CRUD
  data/*.csv                — real Hogskins catalog data (carry over faithfully, don't invent)
  lib/                      — reference auth, bootstrap, business logic
```

---

## 10. Running the app locally

```bash
# 1. Install dependencies (already done; skip if node_modules present)
npm ci

# 2. Start dev server
npm run dev
# → http://localhost:3000

# 3. Sign in
# Use the invite/recovery link that was emailed to msj1542@gmail.com
# (a recovery email was sent during Phase 1 auth debugging)
# If the link has expired, run:
node --env-file=.env.local scripts/resend-invites.mjs
# Then click the link in the email → /auth/callback → /invite → set name+password → /dashboard

# 4. Run tests
npm test
```

---

## 11. File structure (current)

```
app/
  layout.tsx                         # root layout: theme flash-script, Toaster
  globals.css                        # Tailwind base import
  tokens.css                         # all design tokens (light + dark)
  page.tsx                           # root redirect → /dashboard
  (auth)/
    login/page.tsx + actions.ts      # email+password login
    invite/page.tsx + actions.ts     # set name+password on first login
  (app)/
    layout.tsx                       # app shell RSC (requireUser, sidebar, topbar)
    actions.ts                       # signOutAction, exitPreviewAction
    dashboard/page.tsx               # placeholder
    orders/page.tsx + new/page.tsx   # placeholder
    production/page.tsx              # placeholder
    catalog/page.tsx                 # placeholder — Phase 2 target
    resources/page.tsx               # placeholder
    notifications/page.tsx           # placeholder
    company-users/page.tsx           # placeholder
    settings/[section]/page.tsx      # placeholder
  auth/
    callback/page.tsx                # client — handles implicit/OTP/PKCE Supabase links

components/
  layout/
    sidebar.tsx                      # client; role-based nav; sign-out button
    topbar.tsx                       # client; page title; ThemeToggle; notifications bell
    preview-banner.tsx               # client; preview mode warning strip
  ui/
    badge.tsx select.tsx tabs.tsx    # Radix wrappers, token-styled
    button.tsx checkbox.tsx dialog.tsx
    empty-state.tsx input.tsx label.tsx
    status-pill.tsx textarea.tsx
    theme-toggle.tsx toaster.tsx

lib/
  auth.ts                            # getUser, requireUser, preview helpers
  authz/
    policy.ts                        # can(), canAny(), Action type, role×action matrix
    roles.ts                         # ROLES enum, RoleCode type, ROLE_DISPLAY map
    policy.test.ts                   # 23 vitest tests
  db/
    schema.ts                        # Drizzle: roles, companies, users, AppUser type
    index.ts                         # Drizzle client (service-role, transaction-mode pooler)
  hooks/
    use-toast.ts                     # toast(), dismiss(), useToast() — module-level store
  supabase/
    server.ts                        # createClient() for RSC/Server Actions (cookie-based)
    client.ts                        # createClient() for client components (browser)
    admin.ts                         # createAdminClient() — service-role, scripts only
  utils.ts                           # cn() — clsx + tailwind-merge

scripts/
  bootstrap-admin.mjs               # one-time initial admin seed + invite
  resend-invites.mjs                # resend recovery/invite emails
  check-auth-state.mjs              # inspect Supabase auth.users
  check-db.mjs                      # inspect public.users

supabase/
  migrations/
    0001_auth_identity.sql          # roles/companies/users DDL + RLS + trigger + seed

.github/workflows/deploy.yml        # CI: npm ci + db:migrate + build; deploy step = stub
drizzle.config.ts
next.config.ts                      # serverActions.allowedOrigins: ["localhost:3000"]
vitest.config.ts
REBUILD_PLAN.md                     # full product spec; read this first
CLAUDE.md                           # repo instructions + reference app documentation
HANDOFF.md                          # this file
build_phase_reviews/
  Phase1_Audit_Review.md            # raw audit transcript summary
```
