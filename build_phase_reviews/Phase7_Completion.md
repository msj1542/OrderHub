# Phase 7 — Hardening — Completion

Scope: everything in `HANDOFF_Phase6-7.md`'s "Phase 7 Objectives" plus the explicit REQUIRED
list from this session's instructions. Acceptable deferrals (orders workspace scope tabs,
production queue text search, CSV import field-level diff) were left deferred per explicit
instruction — see "Deferred" below.

## 1. RLS own-scope gap — fixed

`supabase/migrations/0007_orders_rls_own_scope.sql` (new migration, applied to production):
adds a `current_order_scope()` SQL helper (mirrors the existing `current_company_id()` /
`current_app_user_id()` pattern from `0001_auth_identity.sql`) and redefines the 3
`_select_external` RLS policies on `orders`, `order_lines`, `order_comments` to match
`lib/orders/service.ts`'s `orderScopeCondition()` exactly: company match, plus a
`created_by_user_id` match whenever `companies.order_scope = 'own'`. Verified against
production by reading back `pg_policies.qual` for all 3 policies and confirming the SQL
text matches the intended condition. `0003_orders.sql`'s original policy text and comments
were left in place (historical accuracy — a fresh migration run applies 0003, then 0007
supersedes it), with the comments updated to point at 0007.

## 2. Vitest suite — 123 → 185 tests

Audited every non-test file in `lib/**` against the existing test files and found 4 pure,
untested modules — all business-logic-bearing, not incidental:
- `lib/pricing/money.test.ts` (22 tests) — money formatting/parsing/rounding, including the
  float-drift case `0.1 + 0.2` that `addMoney()` exists specifically to avoid.
- `lib/settings/tz.test.ts` (10 tests) — business-timezone formatting/parsing roundtrips.
- `lib/catalog/csv.test.ts` (20 tests) — the CSV parser (quoted fields, embedded
  commas/newlines/escaped quotes, BOM stripping) and both import validators (duplicate
  SKUs, unmatched/missing-pricing detection, invalid-price rules including "matte must
  cost more than gloss").
- `lib/authz/roles.test.ts` (10 tests) — role-set classification (`isInternal`/`isExternal`),
  security-relevant since it gates nav visibility and permission checks.

All other untested files (`lib/*/service.ts`, `lib/auth.ts`, `lib/db/*`) are DB-touching and
intentionally excluded, consistent with the project's established pure-unit-test-only
pattern (no DB/Supabase mocking infrastructure exists, by design — see prior phase docs).

## 3. Pagination + server-side filtering — orders, production, catalog, audit, notifications

New shared primitive: `components/ui/pagination.tsx` (Prev/Next + "Page X of Y", follows
the existing design-token/Button conventions). Wired into all 5 required areas:

- **Orders** (`lib/orders/service.ts: listOrders`) — added server-side `search` (ILIKE
  across order number, PO, company name, creator name) and `page`/`pageSize`; returns
  `{ orders, total }`. `OrdersWorkspace` moved search+status filtering from client-side
  array `.filter()` to URL params (debounced search input) with a full page reload via RSC.
- **Production** (`lib/production/service.ts: listWorkOrders`) — added `page`/`pageSize`;
  returns `{ workOrders, total }`. Tab switching resets to page 1. Text search intentionally
  **not** added here — explicitly listed as an acceptable deferral in the handoff
  ("client-side sufficient for current volume"); pagination itself (the required item) is
  done.
- **Catalog** (`lib/catalog/service.ts: listProducts`) — added `page`/`pageSize`, kept
  backward-compatible (unpaginated) for its other 4 call sites (New Order's product picker,
  CSV import validation, the admin Catalog Manager) which need the full list. Only the
  customer/internal-facing `/catalog` browse page got the URL-driven search+pagination UI —
  the admin Catalog Manager's product picker is a CRUD tool, not a list view, same
  reasoning as the New Order line-item picker.
- **Audit** (`lib/audit/service.ts: listAuditLog`) — replaced the flat 200-row cap with real
  `page`/`pageSize` pagination (capped at the same 200-row ceiling in total, since this is a
  read-only timeline, not an export tool).
- **Notifications** (`lib/notifications/service.ts: listNotifications`) — added
  `page`/`pageSize`; per-user read-state lookup now only queries the current page's rows
  (was already fetching read-state per-row, this makes it cheaper too).

All 5 verified via `tsc --noEmit` and a full production build (23/23 routes) — could not be
visually verified in-browser since every route requires a password login, which is outside
what an agent may do (see `Phase7_Manual_E2E_Script.md`, item 5).

## 4. Empty/onboarding states

Audited every list/browse view; most already had `EmptyState` component usage from prior
phases. Found and fixed 2 real gaps with no empty-state handling at all:
`components/settings/company-manager.tsx` (zero companies) and
`components/catalog/material-settings.tsx` (zero materials) — both got a compact inline
message pointing at the existing "+ New" button, consistent with their narrow sidebar-list
layout (matching the pattern already used in `user-manager.tsx`'s "No users yet").
`components/production/production-queue.tsx`'s plain-text "No work orders in this view" was
also upgraded to the `EmptyState` primitive for consistency with every other list view.

## 5. Accessibility (WCAG 2.1 AA)

- **Color contrast (measured, not eyeballed):** computed WCAG relative-luminance contrast
  ratios for `--color-text-muted` (used app-wide for secondary text, timestamps, hints) —
  the original `#6f7c8e` came out to ~4.24:1 on `--color-panel` (white) and ~3.99:1 on
  `--color-canvas`, both below AA's 4.5:1 threshold for normal-size text. Darkened to
  `#647080` in `app/tokens.css` (~5.0:1 / ~4.74:1 respectively) — used only by
  `--color-text-muted`, confirmed via grep, so no other token was affected.
- **Keyboard access:** `components/ui/data-table.tsx`'s sortable column headers were
  mouse-only (`onClick` on a bare `<th>`, no `tabIndex`, no keyboard handler, no
  `aria-sort`). Added `tabIndex`, `role="button"`, `Enter`/`Space` key handling, and a
  correct `aria-sort` attribute.
- **Accessible names on icon-only controls:** two "remove line item" trash-icon buttons in
  `components/orders/new-order.tsx` and the toast dismiss button in
  `components/ui/toaster.tsx` had no accessible name for screen readers — added
  `aria-label`.
- Confirmed already solid and left unchanged: global `:focus-visible` ring
  (`app/globals.css`), `Dialog`'s close button (already had `sr-only` text), semantic
  landmarks (`<header>`/`<nav>`/`<main>` present in the app shell), the app's single `<img>`
  (product thumbnail) already has descriptive `alt` text, system-font-only typography (no
  web font loading, so no FOUT/CLS concern).

## 6. Performance

- **Bundle size:** ~1.5MB total JS across all chunks post-build, no single oversized chunk;
  `qrcode` (label generation) confirmed server-only (only imported from a route handler,
  never bundled to the client). No heavy client-side dependencies found.
- **Root layout parallelization:** `app/(app)/layout.tsx` runs on every authenticated page
  view. `requireUser()` and `getPreviewContext()` were awaited sequentially despite being
  independent (neither depends on the other's result) — changed to `Promise.all`.
- **Route-level loading states:** REBUILD_PLAN.md's UX section calls for "RSC data loads +
  skeleton states" as a "build in now" item; no `loading.tsx` existed anywhere in the app
  (confirmed via `find`). Added `components/ui/skeleton.tsx` (a minimal pulsing-block
  primitive) and `app/(app)/loading.tsx`, giving every route inside the app shell an
  instant-feedback loading state instead of a blank canvas during data fetch — this also
  offsets the extra `count(*)` queries pagination added.
- **Considered and deferred:** converting the one `<img>` (product thumbnail) to
  `next/image`. Its `src` is a signed-URL-redirecting route handler
  (`/api/product-files/[id]`, 60s TTL) rather than a direct static URL; `next/image`'s
  optimizer should follow the redirect, but this couldn't be verified in-browser (auth
  gate), and it's a single 120×120 thumbnail — low risk of shipping unverified, deferred
  rather than guessed at.

## 7. Deploy wiring — code-side prep only

Hosting target was originally Hostinger (SSH-based deploy); revised to **Vercel** later in
this same phase, per instruction. Per explicit instruction, the actual account setup and
domain decision are the account owner's to do — an agent cannot create accounts or make a
domain decision. What's done, current (Vercel) state:
- `.github/workflows/deploy.yml` no longer has a deploy step at all — Vercel's own GitHub
  integration auto-deploys on every push to `main`, outside this workflow. The workflow now
  only runs Drizzle migrations against production and a `npm run build` as a CI validation
  check (no SSH, no secrets beyond the existing Supabase/DB ones already in use for CI).
- `next.config.ts`'s `serverActions.allowedOrigins` has a `TODO` comment marking exactly
  where to add Vercel's auto-generated domain and the eventual custom domain.
- `HANDOFF_Phase6-7.md` has a full "Deploy wiring (Vercel) — setup steps for the account
  owner" section: signing up, connecting the repo, the exact env vars to set in Vercel's
  dashboard, and adding a custom domain once live.

(The original Hostinger version of this section — SSH key generation, 5 GitHub Actions
secrets, `appleboy/ssh-action` — is preserved in this project's git history for reference
but is no longer the current setup.)

## 8. Manual E2E — script written, not run

`build_phase_reviews/Phase7_Manual_E2E_Script.md`: a full click-through script covering the
order lifecycle end-to-end, the two-session Realtime check, invite-email delivery, portal
preview, and dedicated spot-checks for everything Phase 7 added (pagination, empty states,
a11y, the RLS fix). Per explicit instruction, this is for the account owner to run — signing
in requires a password, which no prior phase's agent could do either.

## Deferred (explicitly acceptable per instruction)

- Orders workspace scope tabs ("Needs My Action")
- Production queue text search (client-side sufficient at current volume)
- CSV import field-level diff (counts shown; before/after values not)

## Verification

- `npm test`: 185/185 passing (up from 123/123 at Phase 6 lock)
- `tsc --noEmit`: clean
- `npm run build`: clean, all 23 routes generated
- RLS fix: verified live against production Supabase (policy text read back and compared to
  `orderScopeCondition()`)
- Browser E2E: not performed by this agent (auth gate) — script handed off instead
