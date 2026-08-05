# Ordering Hub — Rebuild Plan (Next.js + Supabase on Hostinger)

## Context

Rebuild of the Hogskins "Ordering Hub" B2B order/fulfillment app on a new stack.
This is a **fresh build, not a port**: the reference app
(`original-reference/` = the Codex `work/site` checkout) is the source of truth
for *behavior, copy, and visuals*, but implementation patterns are only carried
over when they're the best fit here. The prior audit (delivered separately)
catalogued the reference's behavioral bugs, scoping, dependencies, and styling
sprawl; this plan **fixes those by default** and rebuilds the domain behavior on
a stack-native architecture.

**Target stack:** Next.js (App Router, Node runtime) on **Hostinger**, Git-push
deploy from GitHub. **Supabase** for Postgres, Auth, and Storage — replacing
Cloudflare D1 + R2 + Workers *and* the ChatGPT dispatch-layer auth entirely.

## Decisions locked (from your answers)

1. **Expected-completion is configurable but simple.** Two settings groups —
   *order cutoff* (weekday + time) and *estimated completion* (weekday + time).
   Rule: placed on/before cutoff → completed that week by completion weekday/time;
   after cutoff → the following week. No per-order override rule.
2. **Transactional email is in phase 1** (Resend behind a notification service,
   small add). The **reminder/escalation scheduler is deferred** (pg_cron) — it's
   the cumbersome part and needs its own product definition.
3. **Single configurable business timezone** (default `America/Chicago`), read by
   every date computation and formatter.
4. **Pricing always visible to internal staff.** Per-user pricing hiding remains
   only for external users; `external_reference` still can't order. This
   structurally fixes the invoice-verification bug.
5. **Auth is simple email + password now; M365 (Entra ID) SSO later.** No
   magic-link, no Google SSO. Supabase Auth email/password, invite-only, seeded
   first admin. M365 SSO is a later addition.
6. **Palette shifts to a steel-blue / cool-grey system** (not the source's
   red/cream), warmed with complementary accents so it doesn't feel cold. See
   Design System.
7. **Realtime is in now** (Supabase Realtime for the production queue and
   notifications) — unless it proves to add undue complexity, in which case it
   falls back to a later phase.
8. **Single static business timezone** = the pickup/manufacturing location tz.
   One configurable value; per-company tz is not needed.
9. **Dark mode**: tokens are authored light + dark from the start; ship the dark
   toggle in this build if it lands cheaply, otherwise defer just the toggle.
10. **Confirmed deferrals:** reminder/escalation scheduler (later), label reprint
    *tracking* (dropped — see labels note), supplemental orders stay as separate
    linked orders.

---

## Architecture decisions (the deliberate departures from the reference)

- **No single-bootstrap monolith.** The reference renders every screen inside one
  ~2,000-line client component hydrated from one `/api/bootstrap` call. Rebuild
  uses **React Server Components per route** for scoped data loads, **Server
  Actions** for mutations, and small **client islands** only where interactivity
  needs them. Faster first paint, smaller payloads, no giant union-typed `View`.
- **Scoping enforced at the database via RLS, not hand-written `WHERE` clauses.**
  Company / own-scope / pricing visibility become **Postgres Row-Level Security
  policies** — the single biggest structural improvement. This eliminates the
  "did every query remember to scope?" bug class by construction. App requests
  run as the `authenticated` role with the user's JWT claims; a separate
  **service-role** connection is used only for provisioning, seeding, and
  notification fan-out.
- **Two responsibilities, cleanly split:** RLS answers *"which rows can this user
  see?"*; a single **`lib/authz` module** answers *"can this user perform this
  transition?"* (the status-machine × role matrix). Neither is scattered across
  routes.
- **All state transitions are transactional.** Order/work-order transitions run
  inside a DB transaction (fixes the reference's multi-statement, non-atomic
  writes and double-action races).
- **Drizzle ORM owns schema, migrations, and types**; queries go through Drizzle.
  RLS is applied by connecting with per-request JWT claims. *(This is the one spot
  with a viable alternative — Supabase JS client + PostgREST for reads — but a
  single ORM with RLS claims keeps one type source and one query style. Committing
  to Drizzle-with-claims.)*
- **Money is `numeric(12,2)`, computed in cents and rounded on write** — no more
  unrounded floats reconciled with a 0.005 tolerance.
- **Auth is invite-only with a seeded first admin.** Supabase Auth **email +
  password** (no magic-link, no Google; **M365/Entra SSO later**). No "first
  request becomes admin" TOFU: initial admin email(s) come from an env var at
  bootstrap; everyone else is invited by an admin (internal) or company admin
  (external). App `users` rows are pre-created by an admin and linked to
  `auth.users` by email on first sign-in.

### Stack mapping (old → new)

| Concern | Reference | Rebuild |
|---|---|---|
| Framework/host | Next 16 on vinext / CF Worker | Next (App Router, Node) on Hostinger, GitHub push-deploy |
| DB | Cloudflare D1 (SQLite) + Drizzle | Supabase Postgres + Drizzle |
| Scoping | in-code `WHERE` filters | Postgres RLS (+ `authz` for transitions) |
| Auth | ChatGPT SIWC dispatch headers | Supabase Auth email+password (invite-only, seeded admin; M365 SSO later) |
| File storage | Cloudflare R2 | Supabase Storage (signed URLs) |
| Image opt | Cloudflare Images | Supabase Storage image transforms |
| Data delivery | one `/api/bootstrap` → client monolith | RSC per route + Server Actions |
| Email | none (inert) | Resend via notification service (phase 1) |
| Reminders | inert timers | pg_cron (deferred) |
| Labels QR | `qrcode` in a route | `qrcode` in a route (kept) |

---

## Known audit issues — fixed by default in the rebuild

| # | Issue (from audit) | Fix in rebuild |
|---|---|---|
| 1 | Duplicate-PO check bypassed on draft→submit | One `submitOrder()` service used by every submit path; duplicate window checked there |
| 2 | Schedule settings inert | `computeExpectedCompletion(settings, now)` reads the two configurable groups (decision #1) |
| 3 | Reminder/escalation timers inert | Feature deferred; **settings omitted from phase 1** so there's no fake UI |
| 4 | Invoice verify broken for pricing-hidden coordinator | Internal always sees pricing (decision #4); server logic independent of visibility |
| 5 | Invoice "3 matches" are theater | Modal shows real line SKUs/qty + totals; one honest attestation; discrepancy reason required on mismatch |
| 6 | Cancellation can't be declined; request row never resolved | Add `decline_cancellation`; resolve `cancellation_requests` (status/resolvedBy/resolvedAt); clear flag |
| 7 | delete_draft wipes audit trail | Audit log is append-only; draft delete records an event, never deletes prior events |
| 8 | `labelRecords` orphaned | Drop print-count tracking. Labels **auto-generate the correct quantity** at work-order creation and can be **reprinted (one or many)** from the order if damaged — no tracking table |
| 9 | QR trace cosmetic | Kept as a plain navigation deep-link, documented as such (not a security token) |
| 10 | First-user auto-admin (TOFU) | Seeded initial admin via env; invite-only thereafter |
| 11 | Supplemental-order scope leak | Parent-order lookup runs under the requester's RLS scope, so they can't attach to invisible orders |
| 12 | "Read-only preview" is UI-only | Preview is a real server mode: scoped reads via the previewed role, **all mutations rejected server-side** for preview sessions |
| 13 | `seedApplication()` runs every request | Seeding moves to migrations + one-time bootstrap |
| 14 | `products.height` = "required roll width" misnaming | Rename to `required_roll_width_in` / `pattern_length_in` |
| 15 | Unrounded float money | `numeric(12,2)`, cents-based math |
| 16 | Non-atomic transitions / races | Transactional transitions |
| 17 | No behavioral tests | Vitest suite for status machine, scoping, duplicate-PO, invoice rules, schedule calc |
| 18 | Internal users can download any doc | Kept intentionally (internal staff see all) — but now via centralized signed-URL authz + Storage policy |

**Previously-flagged items — now resolved (your call):**
- **Reminder/escalation feature** → deferred to a later phase; recipients +
  thresholds to be defined when built.
- **Label reprint tracking** → dropped. Labels auto-generate at WO creation and
  reprint on demand (one or many); no print-count trail.
- **Supplemental orders** → kept as separate linked orders (own lifecycle, own
  pricing).

---

## Design system (one token set for the whole app)

The reference has ~8 CSS vars plus a cloud of one-off hex, four tab patterns,
five badge treatments, and no spacing/type scale. Replace with **one system**.

**Palette direction (new — not the source's red/cream):** a **steel-blue /
cool-grey** system — medium-to-medium-dark slate/steel-grey primaries with very
light cool-grey surfaces — deliberately warmed by a **complementary accent** (a
muted warm tone, e.g. amber/ochre or soft terracotta used sparingly) plus the
functional success/warning/danger hues, so it reads calm and professional, not
cold or clinical. The brand/accent token is steel-blue; the warm accent is a
secondary token for highlights, primary CTAs' hover, and small emphasis.

**Delivery:** Tailwind v4 with a `tokens.css` custom-property layer as the theme
source; accessible primitives from **shadcn/ui (Radix + Tailwind)** themed to the
token set (avoids rebuilding dialogs/tabs/toasts). Tokens are authored **light +
dark from the start**; light ships first, and the dark toggle ships in this build
if it lands cheaply (decision #9).

**Primitive scales**
- Spacing: 4-based — `2 4 6 8 12 16 20 24 32 40 48`
- Radius: `sm 6 · md 8 · lg 12 · pill`
- Type: `xs 11 · sm 12 · base 13 · md 15 · lg 19 · xl 22 · 2xl 29` (rem-based)
- Weight: `regular 450 · medium 550 · semibold 700 · bold 800`
- Shadow: `sm · md · lg`; one `--topbar-h` var drives all sticky offsets (kills the 91/92/102px magic numbers)

**Semantic color tokens** (each a bg/fg pair, light + dark-ready)
- Surface: `canvas · panel · raised · sunken`
- Border: `subtle · default · strong`
- Text: `primary · muted · inverse`
- Brand/accent: **steel-blue** (single source for the primary brand hue)
- Warm accent: a muted complementary tone for highlights/emphasis (keeps the
  blue-grey system from feeling cold)
- Status families: `neutral · info · success · warning · danger · urgent`
  — **`urgent` (expedited) is its own token**, never reused danger/canceled.
- **Status map:** the 12 order/work statuses map explicitly to these families
  (e.g. submitted/new→warning, accepted/awaiting-pickup→success,
  in-fulfillment/in-progress→info, completed→neutral-purple, canceled→danger,
  draft→neutral) — documented once, not 12 bespoke pairs.

**Component library** (one component per concept, replacing the reference's variants)
Button (primary/secondary/danger/success/ghost/link × md/sm) · Input/Select/
Textarea · **Checkbox** (lists/attestations) vs **Toggle** (settings booleans) —
one rule for which · **Tabs** (single primitive: scope/settings/section variants) ·
Badge/Count · StatusPill · Card · Panel · DataTable + **ExpandableRow** (keep the
reference's good expandable-detail pattern) · Dialog + **ConfirmDialog** (replaces
all `window.confirm`) · Toast · Alert · EmptyState · Timeline · **MasterDetail**
layout (one primitive replacing the 3 duplicated list+detail layouts) · FieldHint/
Tooltip · FormGrid.

---

## File structure

```
app/
  (auth)/login/page.tsx  auth/callback/route.ts  invite/page.tsx
  (app)/
    layout.tsx                       # shell: sidebar+topbar (RSC, loads session+profile)
    dashboard/page.tsx
    orders/page.tsx                  # workspace (RSC list) + client filter island
    orders/new/page.tsx              # builder (edit/reorder/supplemental modes)
    production/page.tsx
    catalog/page.tsx
    resources/page.tsx
    notifications/page.tsx
    company-users/page.tsx
    settings/[section]/page.tsx      # companies|team|catalog|materials|resources|operations|audit
  api/
    production/[id]/print/route.ts   # printable work order / labels + QR (HTML)
    catalog/export/route.ts          # CSV
    resources/[id]/route.ts          # signed download (authz-checked)
  layout.tsx  globals.css
lib/
  supabase/{server.ts, client.ts, admin.ts}   # request(RLS) / browser / service-role
  db/{schema.ts, index.ts}                     # Drizzle + per-request JWT-claims conn
  authz/{policy.ts, roles.ts}                  # can(user, action, resource) matrix
  orders/{service.ts, statusMachine.ts, duplicate.ts}
  production/service.ts
  catalog/{csv.ts, import.ts, export.ts}
  notifications/{service.ts, email.ts}         # in-app + Resend
  settings/{schedule.ts, tz.ts}                # computeExpectedCompletion, formatInTz
  pricing/money.ts
components/ui/*                                 # design-system primitives
components/{orders,production,catalog,settings,...}/*   # feature (server+client)
supabase/
  migrations/*.sql                             # tables, RLS policies, triggers, storage policies
  seed.sql                                     # roles, categories, materials/rolls, catalog CSV, initial admin
drizzle.config.ts
.github/workflows/deploy.yml                   # run migrations, then Hostinger build/deploy
```

**Route-type decisions:** Route Handlers only for printable HTML, CSV export, and
signed downloads. Server Actions for all mutations. RSC for page data. No
`/api/bootstrap` equivalent.

---

## Build order (phases)

- **Phase 0 — Foundations.** Repo, Next+TS, Tailwind v4 + `tokens.css`, shadcn
  primitives, Supabase project, env wiring, GitHub→Hostinger deploy, GitHub Action
  for Drizzle migrations. App shell + placeholder pages.
- **Phase 1 — Auth & identity.** Supabase Auth, login/invite/callback,
  `users`/`companies`/`roles` schema + **RLS**, profile linking, seeded initial
  admin, `authz` module, role-based nav, preview-mode server guard.
- **Phase 2 — Catalog & materials.** products/materials/rolls/prices + RLS, CSV
  import (preview+apply) & export, catalog browse + detail, admin catalog/material
  editors, product files/thumbnails via Storage. *(Upstream of ordering.)*
- **Phase 3 — Ordering core.** Order schema, New Order builder (search, lines,
  custom item, expedited), `submitOrder()` + duplicate-PO service, draft/submit,
  orders workspace + detail, comments/notes, money util.
- **Phase 4 — Fulfillment.** Work orders, production queue, piece tally, re-cuts,
  printable work order/labels (QR), QC, transactional status machine.
- **Phase 5 — Accounting & lifecycle.** Invoice verification (fixed), release,
  close, cancellation request/decline, supplemental & reorder.
- **Phase 6 — Resources, notifications, settings.** Resource library + manager
  (Storage, versions, pricing-restricted), in-app notifications + Resend email,
  settings (companies, team, operations/schedule, timezone, audit history).
- **Phase 7 — Hardening.** Vitest suite, pagination, empty/onboarding states,
  a11y pass, perf, deploy runbook.

*Realtime (production queue + notifications) and dark mode are folded into the
phases above, not deferred. Deferred to a later version: reminder/escalation
scheduler (pg_cron) and M365 SSO.*

---

## UX / feature improvements

**Build in now**
- Single ConfirmDialog for all destructive actions (replaces mixed
  `window.confirm`/modals).
- Invoice verification that shows the actual line items being attested.
- Cancellation **decline** path.
- First-run onboarding for the seeded admin (guided: create company → invite users
  → import catalog).
- Pagination / server-side filter+search on orders, production, catalog, audit,
  notifications (reference had none).
- Real formatted diffs for audit "change details" and CSV import preview (not raw
  JSON dumps).
- RSC data loads + skeleton states; keep the accessible expandable-row pattern.
- **Realtime (Supabase Realtime)** live updates for the production queue and
  notifications — build now; drop to "later" only if it adds undue complexity.
- **Dark mode** — ship in this build if it lands cheaply (tokens are already
  authored light + dark); otherwise defer only the toggle.

**Optional, decide later**
- Reminder/escalation scheduler (pg_cron) + email digests.
- **M365 / Entra ID SSO** (email+password ships now).
- Bulk order operations; saved views/filters.
- Per-company timezone (single static business tz is the intended model).

---

## Running build checklist (one line per page/component)

**Cross-cutting**
- [ ] Design-system tokens + primitives (Button, Tabs, Dialog, ConfirmDialog, Toast, StatusPill, DataTable/ExpandableRow, MasterDetail, EmptyState, Timeline, FormGrid)
- [ ] Supabase project + env + Drizzle schema/migrations pipeline
- [ ] RLS policies per table (company / own / pricing scoping)
- [ ] `authz` action×role matrix + transactional status machine
- [ ] Duplicate-PO service (all submit paths)
- [ ] Expected-completion calc (configurable cutoff/completion) + business-timezone util
- [ ] Money/pricing util (`numeric`, cents)
- [ ] Notification service (in-app + Resend email)
- [ ] Storage buckets + policies + signed-URL downloads
- [ ] Realtime channels (production queue + notifications)
- [ ] Seed (roles, resource categories, materials/rolls, catalog CSVs, initial admin)
- [ ] Test suite (status machine, scoping, duplicate-PO, invoice rules, schedule)

**Auth & shell**
- [ ] App shell (sidebar nav + topbar + role-based nav + notifications bell)
- [ ] Login (email + password) / invite acceptance / auth callback

**Dashboard**
- [ ] Dashboard — internal (actions-required queue + metric cards)
- [ ] Dashboard — external (hero + recent activity + metric cards)

**Ordering**
- [ ] New Order builder (catalog search, line items, custom item, expedited, draft/submit)
- [ ] New Order — reorder mode
- [ ] New Order — supplemental mode
- [ ] Orders workspace (scope tabs, filters, search, table)
- [ ] Order detail (summary, lines, notes, conversation)
- [ ] Order comment composer (customer-visible vs internal)
- [ ] Order actions bar (accept / verify / release / close / cancel / etc.)
- [ ] QC modal
- [ ] Release modal
- [ ] Cancellation modal (request + execute + **decline**)
- [ ] Invoice verification modal (line items + totals — fixed)

**Fulfillment**
- [ ] Production queue (scope tabs, search, table)
- [ ] Production detail (material groups, piece tally, re-cut history)
- [ ] Re-cut modal
- [ ] Printable work order (route)
- [ ] Printable labels + QR (route)

**Catalog**
- [ ] Product catalog (browse + search table)
- [ ] Product details (specs, image, files)
- [ ] Catalog manager (product editor entry)
- [ ] Product editor (fields, materials, prices, file upload, thumbnail)
- [ ] CSV import (preview + apply)
- [ ] CSV export (route)

**Resources**
- [ ] Resource library (categories, download)
- [ ] Resource manager (upload, versions, pricing-restricted)

**Users & settings**
- [ ] Company users portal (external admin)
- [ ] External user manager (primary admin + company users)
- [ ] Settings hub (tabbed)
- [ ] Customers (company list + editor)
- [ ] Company editor (profile + billing)
- [ ] Internal users manager
- [ ] Material settings (list + editor + rolls + cost outputs)
- [ ] Operations settings (rush fee, cutoff group, completion group, duplicate window, timezone)
- [ ] Audit history (timeline)

**Notifications & admin tools**
- [ ] Notifications (current / history, mark read/all)
- [ ] Portal preview (admin) modal + server-enforced read-only mode

---

*All prior open flags are now resolved (see Decisions locked #5–10). The only
item that resurfaces later is defining reminder/escalation recipients & thresholds
when that deferred feature is built.*