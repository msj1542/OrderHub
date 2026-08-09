# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Internal staff** at Glass Tint USA (the designer, manufacturer, and supplier of wholesale pre-cut paint-protection-film kits for motorcycles):
- **Order coordinators** — accept/review submitted orders, resolve
  cancellation requests, monitor duplicate POs.
- **Fulfillment/production specialists** — work the production queue: claim
  work orders, cut kits against roll/material stock, complete QC, print
  work orders and QR labels.
- **Accounting** — verify invoices (SKU/qty/total match or documented
  discrepancy), release orders, close out.
- **Internal admins** — everything above, plus catalog/materials/company/user
  administration and settings (rush fee, cutoff/completion schedule, business
  timezone).

**External customers** (Hogskins' as a B2B wholesale buyer):
- **Company admins** (`external_admin`, one per company) — manage their
  company's users, place orders, view company-wide order history.
- **Purchasers** (`external_ordering`) — browse the catalog and place/track
  orders; scoped to their own orders or the whole company depending on the
  company's `orderScope` setting.
- **Catalog-only viewers** (`external_reference`) — browse catalog/pricing,
  cannot order.

Internal admins can also open a read-only preview as any company/role
combination to see exactly what a given customer sees.

## Product Purpose

OrderHub is the B2B order-submission, fulfillment, and tracking system for
Hogskins to place orders from Glass Tint USA. It takes a PPF kit order from a customer's cart through internal
acceptance, production (cutting against Gloss/Matte roll stock), QC, invoice
verification, and release/pickup — with every transition auditable and
role/company-scoped. Success is orders moving through that lifecycle without
manual reconciliation, scope leaks, or silent business-rule bypasses (the
class of bugs the prior implementation had and this rebuild is fixing by
construction — see Positioning and Capabilities and Constraints).

## Positioning

Built around Hogskins' actual pre-cut PPF kit catalog and production
workflow — encoding real cut/roll/material constraints, the
order→production→QC→invoice status machine, and business rules
(duplicate-PO detection, tiered rush fees, roll-width compatibility) directly
into scoped, role-based order intake and a production-floor queue. A
generic ordering/inventory tool would have to re-encode Hogskins' specific
catalog structure and fulfillment rules to reproduce this; OrderHub is built
around them from the schema up (Postgres RLS for scoping, a dedicated
`authz` status-machine module for transitions).

## Operating Context

- **Two physical/organizational contexts:** an office context (order
  coordinators, accounting, admins working orders/settings/invoices) and a
  production-floor context (fulfillment staff cutting kits against work
  orders, printing/scanning QR-coded labels that trace back to the order).
- **Order lifecycle:** Draft → Submitted → Accepted → In Fulfillment →
  Fulfillment Completed → Ready for Pickup → Released → Invoiced/Closed, with
  a Canceled branch (customers can only *request* cancellation; a
  coordinator executes accept/decline).
- **Expedited orders** are order-level only (not per line item, per a
  post-launch revision decision) and carry a tiered rush fee computed from a
  configurable cutoff/completion schedule.
- **Supplemental orders**: a separately-priced, separately-lifecycled order
  linked to an already-submitted parent order.
- **Documents/materials involved:** the kit catalog (brand/model/year/part),
  Gloss/Matte film rolls, price lists, install instructions, product
  diagrams/images — the last group lives in a Resources library backed by
  Supabase Storage.
- **This is a rebuild.** `original-reference/` (not checked out in this
  repo; see `CLAUDE.md`) is the source-of-truth reference app for behavior,
  visuals, and copy. The rebuild is a fresh implementation on a new stack,
  not a port — see `REBUILD_PLAN.md` for the full architecture decisions and
  `CLAUDE.md` rule 3 for which reference behaviors are functional spec versus
  incidental. The initial 7-phase build is complete and audited; the project
  is currently in a post-launch revision pass driven by the user's hands-on
  review (tracked in `build_phase_reviews/Plan_and_Progress.md`), not a
  first build.

## Capabilities and Constraints

- **Scoping is enforced at the database via Postgres RLS**, not hand-written
  `WHERE` filters — company scope, own-vs-company order visibility, and
  per-user pricing visibility are policies, not app-code checks.
- **A dedicated `lib/authz` module** answers "can this user perform this
  status transition," separate from RLS's "which rows can this user see."
- **All state transitions are transactional** (order/work-order status
  changes run inside a DB transaction).
- **Money is `numeric(12,2)`**, computed in cents and rounded on write — no
  unrounded-float reconciliation.
- **Pricing is always visible to internal staff**; per-user pricing hiding
  applies only to external users, and `external_reference` users can never
  order.
- **Auth is invite-only**: Supabase Auth email + password now, no
  magic-link/Google; M365/Entra SSO is a later addition. Initial admin is
  seeded via env var, not first-authenticated-user auto-admin.
- **Realtime** (Supabase Realtime) drives the production queue and
  notifications.
- **Read-only company/role preview mode** for internal admins is a real
  server-enforced mode — all mutations are rejected server-side for preview
  sessions, not just hidden in the UI.
- **Single configurable business timezone** (default `America/Chicago`)
  drives every date computation and formatter — not per-company.
- **Deferred (not in current scope):** reminder/escalation scheduler
  (pg_cron-based; needs its own product definition before it's built), M365
  SSO, label print-count tracking (deliberately dropped — labels
  auto-generate the correct quantity at work-order creation and can be
  reprinted on demand instead of tracked).
- **Terminology:** "roll width" fields were historically mislabeled in the
  reference app (`products.height` meant required roll width) — the rebuild
  renames these to `required_roll_width_in` / `pattern_length_in`.

## Brand Commitments

- Product/company name: **Glass Tint USA** (supplier / creator), **Hogskins** (buyer), app name **Ordering Hub /
  OrderHub**.
- Visual system is a deliberate departure from the reference app's red/cream
  palette: a steel-blue / cool-grey system warmed with a complementary warm
  accent (amber/ochre or terracotta), authored light + dark from the start.
  (Full detail belongs in DESIGN.md, not here — this is the binding
  constraint that a redesign must not silently discard.)

## Evidence on Hand

- **Real Hogskins catalog/company data has not been imported into this
  rebuild yet.** `supabase/seed.sql` is currently a placeholder; the actual
  catalog CSVs and company records exist only in `original-reference/`
  (not checked out in this repo). Do not fabricate placeholder catalog
  entries, customer names, or pricing to fill this gap — source real data
  from `original-reference/` or the user when the catalog/materials/company
  seed work resumes.
- A real user hands-on review of the completed 7-phase build produced 29
  annotated screenshots and written revision instructions, archived at
  `build_phase_reviews/Revisions.zip` (extracted to
  `build_phase_reviews/extracted/`) and distilled into
  `build_phase_reviews/Plan_and_Progress.md`. This is real product feedback,
  not synthetic research.
- Phase-by-phase completion and audit records for everything built so far
  live in `build_phase_reviews/*.md` (see `HANDOFF_Phase6-7.md` for the
  index) — treat as evidence of current implementation state, not aspiration.

## Product Principles

1. **Fix scope/business-rule bugs by construction, not by convention.** Where
   the reference app relied on every code path remembering to check scope or
   a business rule (and sometimes didn't — see the audit issues in
   `REBUILD_PLAN.md`), the rebuild moves the guarantee into the database
   (RLS) or a single shared service, so it can't be silently bypassed by a
   new call site.
2. **One state machine, transactionally enforced.** Order/work-order status
   transitions have one authoritative path (`authz` + service functions run
   in a DB transaction) rather than being reachable from multiple
   ad-hoc mutation sites.
3. **Preserve real business rules as functional spec.** Duplicate-PO
   detection windows, QC/invoice attestation requirements, roll-width/
   material compatibility, and rush-fee tiering encode actual Hogskins
   business rules — treat changes to these as product decisions, not
   implementation details, and flag inferences per `CLAUDE.md` rule 4.
4. **Internal and external users share one system, not a fork.** Both
   audiences are served from the same schema/lifecycle with role- and
   RLS-based visibility differences, not parallel implementations — keeps
   the internal preview-as-customer mode meaningful and prevents behavior
   drift between the two surfaces.
5. **Don't fabricate data to fill gaps.** Real Hogskins catalog, pricing, and
   company data is the standard (see Evidence on Hand); placeholder/synthetic
   data is acceptable only when the user explicitly asks for it.

## Accessibility & Inclusion

WCAG 2.1 AA, already established and audited in the current build (Phase 7):
computed WCAG relative-luminance color contrast (not eyeballed), accessible
names required on icon-only controls (e.g. icon-only remove/trash buttons,
toaster). Preserve this standard in new and revised UI.
