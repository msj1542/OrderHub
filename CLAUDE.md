# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`OrderHub` is a rebuild workspace. It does not yet contain application code. The
directory `original-reference/` (once present here) is a copy of a working
reference application — currently checked out at
`C:\Users\mjager\Documents\Codex\2026-07-29\ordering-hub-sites-project-appgprj-6a6a8e869e3081918c3c61a26d78c2d8-2\work\site`
— and every mention of `original-reference/` in this file and in future
instructions refers to that codebase. The goal of work in this repo is to
rebuild/reimplement that application; the reference is the source of truth for
behavior, visuals, and copy.

**Inference flag:** the exact target stack, hosting model, and repo layout for
the rebuild itself have not been specified. This file documents the reference
app as read from `original-reference/` so a rebuild can match it faithfully.
Nothing below should be read as a decision about what the *new* implementation
must use technically — only what it must reproduce functionally/visually
unless told otherwise.

## What the reference app does

**Ordering Hub** is a B2B order-submission, fulfillment, and tracking system
for **Hogskins**, a supplier of pre-cut paint-protection-film (PPF) kits for
vehicles (kits are identified by brand/model/year/part, cut from Gloss or
Matte film rolls). It serves two audiences from one codebase:

- **Internal staff** (order coordinators, production/fulfillment specialists,
  accounting, administrators) who accept, produce, QC, invoice-verify, and
  release orders.
- **External customers** (company admins, purchasers, catalog-only viewers)
  who browse the catalog, place orders, track status, and download resources.

Authentication is "Sign in with ChatGPT" (SIWC), provided by the OpenAI Sites
dispatch layer via request headers (`oai-authenticated-user-email`, etc.) —
see `original-reference/app/chatgpt-auth.ts`. There is no in-app login form.
The first authenticated user to hit an empty database is auto-provisioned as
an internal admin (`lib/auth.ts: requireAppUser`); every subsequent unknown
email is rejected until an admin creates their account.

### Order lifecycle

`Draft → Submitted → Accepted → In Fulfillment → Fulfillment Completed →
Ready for Pickup → Released → Invoiced/Closed`, with a `Canceled` branch from
`Submitted`/`Accepted` (customers can only *request* cancellation; an internal
coordinator executes it). Every transition is a `POST
/api/orders/[id]/action` call with an `action` string (`submit_draft`,
`accept`, `claim`/`start`, `qc`, `invoice`, `release`, `close`,
`request_cancel`, `cancel`, `comment`, `print_labels`) — see
`original-reference/app/api/orders/[id]/action/route.ts` for the exact
role/status guard on each. Accepting an order creates a
`productionWorkOrders` row; QC completion requires all `QC_ITEMS` answered
true; invoice verification requires SKU/quantity/total match (or a documented
discrepancy reason) before release. "Expedited" orders carry a requested date
and an automatic rush fee (percentage/flat/disabled, configurable in
Settings). Orders also support a linked, separately-priced **supplemental
order** against an already-submitted parent order.

### Roles

Internal: `internal_admin`, `order_coordinator`, `fulfillment`, `accounting`
(role codes in `db/schema.ts: roles` / `ROLE_SEED` in `lib/bootstrap.ts`).
`internal_admin` implicitly has every internal permission (`lib/auth.ts:
can()`). External: `external_admin` (one primary company admin per company,
manages that company's users), `external_ordering` (can place orders),
`external_reference` (catalog/pricing viewer only, no ordering). A company's
`orderScope` ("own" vs "company") further restricts whether an
`external_ordering` user sees only their own orders or the whole company's.
Internal admins can open a **read-only portal preview** as any company/role
combination (`PortalPreviewModal`) to see exactly what a customer sees.

## Pages / screens (reference app)

All screens are client-rendered inside one component,
`original-reference/app/ordering-hub-app.tsx` (~2,000 lines, single `View`
union type), fetched from one bootstrap endpoint
(`GET /api/bootstrap` → `lib/bootstrap.ts: loadApplication`). There is no
client-side router; navigation is local React state (`setView`).

| View | Internal | External | Purpose |
|---|---|---|---|
| **Dashboard** | ✓ | ✓ | Role-specific attention queue (needs-review orders, work orders needing action, expedited/overdue counts) + quick stats. |
| **New Order** | via Orders | ✓ (if `external_ordering`/company admin) | Catalog line-item builder + custom-item requests, duplicate-PO detection, expedited date, draft save vs. submit. Also used for "reorder" and "supplemental order" entry modes. |
| **Orders** (`OrdersWorkspace`) | ✓ | ✓ | List + detail (`OrderDetail`) of orders scoped to role; comment thread (customer-visible vs. internal notes), status actions, QC/Release/Cancellation/Invoice modals. |
| **Production Queue** | ✓ | — | Work-order queue, scoped by tabs (Current Work / Completed-On Site / Released-Archived per `design-qa.md`); piece-by-piece completion tally, non-billable re-cut recording, print work order/labels (QR-coded, traceable back to the order). |
| **Product Catalog** (`ProductCatalog`) | ✓ | ✓ | Browse/search kits by brand/model/year; `ProductDetails` shows compatible materials, pricing (if visible), resources. Internal admins additionally get `CatalogManager`/`ProductEditor` for editing products, materials, pricing, and CSV import/export. |
| **Resources** | ✓ | ✓ | Document library by category (price lists, install instructions, diagrams, product images/docs) stored in Cloudflare R2; internal `ResourceManager` uploads/versions files and can pin a product thumbnail. |
| **Company Users** | — | ✓ (company admin only) | External-facing user management for one company (`ExternalUserManager`). |
| **Notifications** | ✓ | ✓ | In-app event feed (order submitted/accepted/ready/cancellation-requested/etc.), mark read / mark all read. |
| **Settings** (`SettingsHub`) | ✓ (admin) | — | `Customers` (companies + preview launcher), `InternalUsers`, `MaterialSettings` (materials + roll inventory/cost), business rule settings (rush fee, weekly cutoff/completion schedule, reminder/escalation timers), `AuditHistory`. |

## Current stack (reference app)

- **Framework:** Next.js 16 (App Router) running on **vinext**
  (`vinext` + `@vitejs/plugin-rsc`), Cloudflare's Vite-based adapter that lets
  a Next.js app deploy as a Cloudflare Worker — not the standard Next.js
  server. Entry worker: `original-reference/worker/index.ts`.
- **Hosting:** Cloudflare Workers/Pages via "OpenAI Sites" — bindings
  declared in `.openai/hosting.json` (`d1` → `DB`, `r2` → `BUCKET`) and
  simulated locally by `vite.config.ts`.
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
  (`db/schema.ts`, `db/index.ts`). Migrations in `drizzle/`, generated with
  `drizzle-kit` (`npm run db:generate`).
- **File storage:** Cloudflare R2 (`env.BUCKET`) for uploaded documents.
- **UI:** React 19, single large client component per page group (no routing
  library), hand-written CSS with Tailwind v4 (`@tailwindcss/postcss`) only
  for the `@import "tailwindcss"` base layer — almost all visual styling is
  bespoke CSS in `app/globals.css` using CSS custom properties, not utility
  classes.
- **Auth:** OpenAI "Sign in with ChatGPT" dispatch-owned headers (no
  password/OAuth code in-app); see `README.md` "Workspace Auth Headers" and
  `app/chatgpt-auth.ts`.
  QR labels via the `qrcode` package.
- **Build/deploy tooling:** the `scripts/*.sh` helpers are specific to the
  OpenAI "Sites" hosting lifecycle (bounded/non-retrying installs and builds,
  artifact validation) — not general-purpose and not necessarily part of a
  rebuild's tooling.

### Reference commands (run only inside `original-reference/`)

These apply to the reference checkout for inspection/comparison. Do not
assume they exist yet for a rebuild in this repo until its own tooling is
scaffolded.

- `npm run install:ci` — one bounded, non-retrying `npm ci`
- `npm run dev` — Vite/vinext dev server
- `npm run build` — build + validate the deployable Cloudflare artifact
- `npm run start` — run the built app
- `npm test` — build, then `node --test tests/rendered-html.test.mjs`
  (also see `tests/ordering-hub-workflows.test.mjs`, which asserts on raw
  source text of the reference app/API routes — useful as a checklist of
  behaviors a rebuild must preserve)
- `npm run lint` — `eslint . --ignore-pattern dist --ignore-pattern .next`
- `npm run db:generate` — generate a Drizzle migration after a schema change

## Rebuild rules

1. **`original-reference/` is read-only. Never edit anything under it.** It
   exists purely as the ground truth to read, compare against, and copy
   behavior/content from.
2. **Visual and copy fidelity is required by default.** Match layout,
   spacing, colors, component states, wording, labels, and copy exactly as
   found in `original-reference/` (see `app/globals.css` for the design
   tokens and `ordering-hub-app.tsx` for exact UI strings) — unless the user
   explicitly says to deviate for a specific piece.
3. **Preserve behavior, not just appearance.** The order status machine, role
   permission checks, validation rules (e.g. duplicate PO window, QC/invoice
   attestation requirements, roll-width/material compatibility checks), and
   audit logging in the reference implementation encode real business rules
   from `original-reference/app/api/**` and `lib/**`. Treat these as
   functional spec, not incidental implementation detail, when rebuilding —
   flag any place a straightforward port isn't possible instead of silently
   dropping a rule.
4. **Flag inferences.** Where the reference app's intent isn't explicit in
   code/comments/README (e.g., business meaning of a field, why a limit is
   set to a particular value), say so explicitly rather than presenting a
   guess as fact.
5. **Data/content in `original-reference/`** (the seeded `data/*.csv`
   catalog, roles, settings defaults) reflects real Hogskins business data —
   carry values over deliberately, don't invent placeholder equivalents,
   unless asked to use synthetic data instead.
