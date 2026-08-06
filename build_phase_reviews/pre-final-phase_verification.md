Pre-Final Phase Verification — Phase 6 Lock / Phase 7 Readiness

Scope: comprehensive re-verification of every REBUILD_PLAN.md checklist item built
through Phase 6, plus cross-cutting consistency checks. Performed by re-reading source,
grepping for usage/regressions, and querying production Supabase directly (not just
re-reading migration files). No Phase 7 work was started.

---

## 1. Cross-cutting items

- ✓ Design-system tokens + primitives — Button, Tabs, Dialog, DataTable, ConfirmDialog, MasterDetail, Toaster all have confirmed call sites (`catalog-manager.tsx` uses Tabs, 4 files use Dialog, `catalog-browse.tsx` uses DataTable, `orders/page.tsx` uses MasterDetail, `order-actions.tsx` uses ConfirmDialog, `app/layout.tsx` mounts Toaster). Note: `production-queue.tsx` renders its own inline tab bar rather than the `Tabs` primitive — pre-existing from Phase 4, cosmetic only, not a Phase 6 regression.
- ✓ Supabase project + env + Drizzle migrations pipeline — `db:generate`/`db:migrate`/`db:push`/`db:studio` all present in package.json; 6 migrations in `supabase/migrations/`, all applied to production (confirmed below).
- ✓ RLS policies per table — **all 26 public tables** have `rls_enabled=true` with at least 1 policy (queried `pg_class.relrowsecurity` + `pg_policies` directly against production). This exceeds the literal "7 tables" framing — every table introduced across Phases 1–6 has RLS enabled. See Section 8/11 for a scoping-fidelity caveat on 3 of those tables.
- ✓ authz action×role matrix — exactly 28 actions defined in `lib/authz/policy.ts` (counted directly), covering all 7 roles via `can()`/`ROLE_PERMISSIONS`/`INTERNAL_ADMIN_ACTIONS`. `lib/authz/policy.test.ts` (23 tests) covers key role/action boundaries and the `pricing:view` special case, not the full 28×7 matrix exhaustively — consistent with the project's established "test the rule, not every cell" pattern.
- ✓ Duplicate-PO service — `checkDuplicatePO()` tested (6 tests, `lib/orders/duplicate.test.ts`); confirmed the **only** code path that sets `orders.status = 'submitted'` is `saveOrSubmitOrder()` (grepped for all writers of `"submitted"` — one hit outside type defs/reads), and it runs the dupe check before every submit. All submit paths (new order, reorder, supplemental) funnel through this one function.
- ✓ Expected-completion calc — `computeExpectedCompletion()` tested (5 cases in `schedule.test.ts`); called from `saveOrSubmitOrder()` on every draft/submit and re-applied in `acceptOrder()` if a coordinator overrides the date.
- ✓ Money/pricing util — `toDecimal`/`addMoney`/`formatMoney`/`parseMoney` used consistently across every price-touching file (`orders/service.ts`, `production/service.ts`, catalog components, `invoice-verify-modal.tsx`, `new-order.tsx`, `order-detail.tsx`, `orders-workspace.tsx`). No raw float arithmetic on money found outside the util.
- ✓ Notification service — in-app fully wired (6 trigger points, matching the reference app's event set exactly); Resend guarded no-op confirmed via `emailGuard.test.ts` (6 tests) using the actual shipped placeholder values (`re_..` / `orders@yourdomain.com`) as literal test fixtures.
- ✓ Storage buckets + policies + signed-URL downloads — both `product-files` and `resources` buckets confirmed present and private (`public=false`) via direct query; both have matching signed-URL download routes (`/api/product-files/[id]`, `/api/resources/[id]`) using the same pattern.
- ✓ Realtime channels — see Section 3/11 for full prerequisite re-verification (publication membership, `REPLICA IDENTITY FULL`, RLS) — all confirmed against production this session.
- ✓ Seed — 7 roles, 2 materials, 38 products, 76 prices, 4 resource categories confirmed present in production via direct query. Initial admin (`msj1542@gmail.com`) present and active; a second `internal_admin` (`michael@glasstintusa.com`) is also present, active — consistent with the Phase 6 internal-user-invite flow having been used since deployment (not something this audit can confirm was exercised via the actual invite email, only that the resulting row exists correctly).
- ✓ Test suite — 123/123 passing, fresh run this session. Growth line (23→64→101→123 mentioned in the request) roughly tracks Phase 1/4/5/6 milestones; all currently green.

## 2. Auth & shell

- ✓ Login (email + password) — `/login` via `@supabase/ssr`, code present and unchanged since Phase 1.
- ✓ Invite acceptance + callback — `/invite` + `/auth/callback` (handles all 3 Supabase link formats: implicit hash, OTP token_hash, PKCE code); Phase 6's `createUser()` now actually triggers this path via `admin.auth.admin.inviteUserByEmail()` where before it had no caller.
- ✓ App shell — sidebar/topbar/role-based nav confirmed via `buildNav()` gating every item behind `can()`; reasoned through all 7 roles against `lib/authz/policy.ts` — no role sees a nav item it lacks permission for. Notification bell present in Topbar with live unread count.
- ✓ Dark mode toggle — confirmed reads/writes `localStorage.getItem/setItem("theme")`, applies `prefers-color-scheme` fallback, sets `data-theme` attribute. Working as designed.
- ✓ Sign-out button — present in sidebar footer (`signOutAction` form).
- ✓ Portal preview — `enterPreviewAction` (Phase 6, company editor launcher) + `assertNotPreview` server guard (Phase 1, enforced in every write Server Action) both confirmed present. See Phase6_Audit_1.md note: launcher is an inline panel, not a modal dialog — cosmetic deviation from checklist wording, not a functional gap.

## 3. Ordering (Phases 3–5)

- ✓ New Order builder — catalog search, line items, custom items, expedited+rush fee, draft/submit all present in `new-order.tsx`; code-reviewed, unchanged by Phase 6.
- ✓ Draft/submit — order numbers generated via `order_number_seq` on submit only; duplicate check gated to submit mode (see Section 1).
- ✓ Orders workspace — search + status filter chips + URL-synced selection (`?id=`) + `MasterDetail` layout, confirmed in `orders/page.tsx` + `orders-workspace.tsx`.
- ✓ Order detail — lines, totals (pricing-gated), notes (customer vs. internal), comment thread, action bar all present and role-gated via `can()`.
- ✓ Accept → invoice verify → release → close chain — status machine enforces the full sequence (`statusMachine.test.ts`, 30 tests including the Phase 5 additions); all 4 service functions (`acceptOrder`, `invoiceVerifyOrder`, `releaseOrder`, `closeOrder`) transactional, confirmed via direct read this session.
- ✓ Cancellation — request/decline/execute all confirmed wired end-to-end (re-verified in the prior Phase 5 audit; unchanged since).
- ✓ Reorder mode — prefills lines + company from the source order, re-resolves each catalog line against the **current** product list (skips lines whose product is no longer available, by design).
- ✓ Supplemental orders — prefills company only (not lines, by design — a supplemental order is new items against an existing order); parent-order lookup now scoped to the requester via `orderScopeCondition()` (fixed during the Phase 5 audit, re-confirmed present this session).

## 4. Fulfillment (Phase 4)

- ✓ Production queue — tabs (Current/Completed/Archived/All), expandable rows, piece tally all present, unchanged by Phase 6 except the new Realtime subscription.
- ✓ Work order creation on accept — transactional (`acceptOrder()`'s `db.transaction` inserts the WO row), due date set from `expectedCompletionDate`.
- ✓ Piece progress — ≤45 individual numbered squares / >45 batched-5 groups, both code paths present in `production-queue.tsx`.
- ✓ Re-cut modal + material usage calc — `(patternLengthIn + 1) × qty`, tested (`service.test.ts`).
- ✓ QC — 3-item checklist + attestation checkbox that only unlocks once all 3 are checked, tested.
- ✓ Work order status transitions — `pending → in_progress → completed → awaiting_pickup → released` (+ `canceled`), aligned 1:1 with order transitions (claim→in_progress, QC→completed, invoice_verify→awaiting_pickup, release→released).
- ✓ Printable work order + labels with QR — both routes present (`/api/production/[id]/print?type=work-order|labels`), SHA-256 trace codes confirmed in prior review, unchanged.
- ✓ Work order section on order detail — visible for internal users, links to Print Work Order/Labels present.
- **~ Label reprint — partial.** Confirmed available for `pending`, `in_progress`, `completed`, and `awaiting_pickup` (the Phase 4 audit fix). **Not** available once a work order reaches `released`. The checklist phrasing ("available at all stages, not just pending/in_progress") is satisfied relative to the pre-audit-fix baseline (2 stages → 4 stages) but not literally "all stages" — `released` work orders have no reprint entry point in the UI today. Low severity (a released order has already shipped; reprinting a label for it is an edge case), but flagging for accuracy rather than rounding up to a full ✓.

## 5. Catalog & materials (Phase 2)

- ✓ Product schema + materials + prices + files — all linked correctly (`product_materials`, `prices`, `product_files` FKs); unchanged by Phase 6, confirmed present via direct query (38 products / 76 prices / 2 materials still in production).
- ✓ CSV import — `csv-import.tsx` + `lib/catalog/csv.ts` present, preview-then-apply flow unchanged.
- ✓ CSV export — `/api/catalog/export` route present, unchanged.
- ✓ Catalog browse — search + expandable detail (`catalog-browse.tsx` using `DataTable`), unchanged.
- ✓ Product editor — fields, materials, prices, file upload, thumbnail pin all present in `product-editor.tsx`, unchanged.
- ✓ Material settings — list/rolls/cost outputs present in `material-settings.tsx`, unchanged.

## 6. Resources & notifications (Phase 6)

- ✓ Resource library — categories + download + pricing-gated visibility, confirmed via `canExternalUserSeeResource()` shared by the browse list and the download route.
- ✓ Resource manager — category quick-add, resource CRUD, version upload all present and functional per code review.
- ✓ Notifications — in-app list + unread count + mark read/all, confirmed; bell updates live via a `postgres_changes` INSERT subscription (RLS-scoped, see Section 11).
- ✓ Email — Resend wrapper code-complete, 6 triggers wired (2 on submit, 1 each on accept/QC-complete/invoice-verify/cancellation-request), guarded no-op confirmed against the literal shipped placeholder values. **Clarification on "6 triggers":** all 6 notification events fire in-app; only the 3 customer-facing ones (submitted, accepted, ready-for-pickup) additionally attempt email, matching the reference app's behavior of not emailing internal-broadcast events. Ready to activate — no code change needed once real `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are set.

## 7. Settings (Phase 6)

- ✓ Company manager — profile/billing fields (contact name/email/phone, billing notes) all editable; preview launcher present (role-gated to `EXTERNAL_ROLES`, `portal:preview` action).
- ✓ Internal users — list/invite/deactivate present; invite wired to a real Supabase Auth email send (`inviteUserByEmail`), with row rollback on failure.
- ✓ External user manager — company-admin self-service present, scoped correctly (target-company + not-another-admin checks re-verified this session — see Section 8).
- ✓ Operations — timezone, cutoff, completion, rush fee, duplicate window all present and validated (`validateOperationsSettings`, 10 tests).
- ✓ Audit history — timeline present, 200-entry cap confirmed in `listAuditLog()`.

## 8. Consistency checks — visibility rules synced

- ✓ Notification visibility — pure fn / Drizzle / RLS walked branch-by-branch this session (targeted, internal-broadcast, company-broadcast, and the internal-only-broadcast-viewed-by-external edge case). All three match. (Re-confirms Phase6_Audit_1.md's finding; no new divergence found.)
- ✓ Resource visibility — stronger than "synced": `listResources()`, `getResource()`, and the download route all call the **same** `canExternalUserSeeResource()` function rather than re-implementing it; only the RLS policy is a necessarily-separate SQL copy, and it matches.
- **~ Order scoping (company/own) — partial match, zero live impact.** The app-layer `orderScopeCondition()` (used by every real read, since Drizzle runs as service-role) correctly implements both `company` and `own` scope. The RLS policies on `orders`, `order_lines`, and `order_comments` (written in Phase 3) implement **company-only** scoping — the policy comment literally says *"own-scope check done in app code."* For a company configured with `orderScope: "own"`, these RLS policies are more permissive than the app layer: any user in that company could read another user's order rows if ever accessed through the `authenticated`-role connection (PostgREST, or a future Realtime subscription on these tables). **Today this has zero live impact** — `orders`/`order_lines`/`order_comments` are not in the `supabase_realtime` publication, and all app reads go through the service-role connection where `orderScopeCondition()` is authoritative. This is pre-existing Phase 3 design (not a Phase 5/6 regression), self-documented by the policy's own comment, and only becomes a live issue if a future phase adds Realtime or PostgREST access to these three tables without first tightening the RLS to match. Flagging per the request's explicit "all match?" question — they don't fully match, though the divergence is inert today.

## 9. Status machines

- ✓ Order statuses — `Draft → Submitted → Accepted → In Fulfillment → Fulfillment Completed → Ready for Pickup → Released → Closed`, + `Canceled` branch — all 11 transitions defined in `TRANSITIONS`, each gated by both `can(user, authzAction)` and `assertCanTransition()` (state gate). 30 tests cover every transition's from-status set and authz wiring.
- ✓ Work order statuses — `Pending → In Progress → Completed → Awaiting Pickup → Released` (+ `Canceled`) — aligned with order transitions 1:1 as documented in Section 4.

## 10. Transactional integrity

- ✓ `acceptOrder()` creates the work order inside the same `db.transaction` as the status update — confirmed by direct read.
- ✓ `saveOrSubmitOrder()` checks the duplicate PO **before** opening the transaction (a separate query), so a duplicate never reaches a write. Not perfectly race-safe against two simultaneous submissions with an identical PO in the same instant (no row lock), but this is pre-existing Phase 3 design, not a new gap.
- ✓ Every status-changing service function (`acceptOrder`, `claimOrder`, `cancelOrder`, `declineCancellation`, `invoiceVerifyOrder`, `releaseOrder`, `closeOrder`, `submitQC`) inserts both `order_status_history` and `audit_log` inside the same transaction as the state change — confirmed by direct read of all 8 functions this session.
- ✓ Invoice verification, release, and close all wrapped in `db.transaction` — confirmed.

## 11. RLS coverage

- ✓ All 26 public tables have RLS enabled with ≥1 policy (see Section 1) — exceeds the 7-table framing in the request; every table across all 6 migrations is covered.
- ✓ Service-role Drizzle connection bypasses RLS — confirmed by architecture (documented in `lib/db/index.ts` and `HANDOFF_Phase0-6.md`) and consistent with every service function's ability to read cross-company data before applying its own `WHERE` scoping.
- ✓ Authenticated-role RLS correctly scopes the 3 Realtime-published tables — re-verified this session against production:
  - Publication membership: `notifications`, `production_line_progress`, `production_work_orders` all present in `pg_publication_tables` for `supabase_realtime`.
  - `REPLICA IDENTITY FULL`: queried `pg_class.relreplident` directly — all 3 report `'f'` (full).
  - RLS policies: `production_work_orders`/`production_line_progress` correctly restrict to `is_internal_user()` (the only role that ever uses this data); `notifications` correctly implements the 3-branch visibility rule (see Section 8). No gap found on these 3 tables specifically — the Section 8 finding is about 3 **different**, non-Realtime tables (`orders`/`order_lines`/`order_comments`).

## 12. Build & tests

- ✓ `npm run build` passes — clean, no warnings printed, all 23 routes generated (fresh run this session, post-verification).
- ✓ `npm test` passes — 123/123, fresh run this session.
- ✓ `tsc --noEmit` passes — zero errors, fresh run this session (no stale `.next` cache artifacts this time; `.next` was already clean from Phase 5's cleanup).
- ✓ Migration applied to production Supabase — re-verified this session via direct query (not just re-running `verify-phase6.mjs`, but a broader `scripts/verify-full.mjs` covering every table's RLS state, seed counts, and both storage buckets).

## 13. Known deferrals (post-MVP, not Phase 7)

- ✓ Reminder/escalation scheduler (pg_cron) — documented in `HANDOFF_Phase0-6.md`'s Phase 7 Non-Goals as post-MVP, recipients/thresholds undefined.
- ✓ M365/Entra SSO — documented alongside it, same section.
- ✓ Server-side pagination — documented under Phase 7 Objectives (not this list's "post-MVP" bucket, but explicitly scoped to Phase 7, not done yet — confirmed absent from the codebase: all list views still load full result sets).
- **N/A — Realtime fallback.** This item doesn't apply as stated: Realtime was **not** deferred in Phase 6 — it was built in full, with real RLS, per your explicit decision this phase ("Build it with real scoped RLS"). The *historical* deferral (Phase 4 → Phase 6, flagged in `Phase4_Audit_1.md`) is documented in `HANDOFF_Phase0-6.md`'s Phase 5/6 summaries as resolved, not as a standing fallback. If the intent was to confirm the old deferral note didn't get lost — it didn't; it's documented as completed, not silently dropped.

---

## Findings requiring attention (not blocking, flagged per your instruction to surface now rather than defer)

1. **Order/order_lines/order_comments RLS is company-only, not own-scope** (Section 8). Pre-existing Phase 3 design, self-documented by its own code comment, zero live impact (these tables aren't Realtime-published and all app reads bypass RLS via service-role). Recommend tightening this RLS to mirror `orderScopeCondition()` before any future phase adds Realtime or direct PostgREST access to these tables — not urgent today.
2. **Label reprint unavailable once a work order is `released`** (Section 4). Minor, edge-case (order has already shipped). If "all stages" was meant literally, this is a one-line UI-condition fix in `production-queue.tsx` (same pattern as the Phase 4 fix that added `completed`/`awaiting_pickup`).

Neither finding is new since Phase 6 — both are pre-existing (Phase 3 and Phase 4 respectively) and were not caused or worsened by Phase 6 work. Both are optional to fix now or carry into Phase 7 hardening; your call.

---

## Verdict

All 13 sections pass with the two flagged non-blocking findings above (both pre-existing,
both zero live impact, both documented rather than silently carried forward). No section
failed outright. **Phase 6 is locked. Phase 7 is ready to begin** once you've reviewed the
two findings and decided whether either warrants a quick fix before Phase 7 starts or can
ride along as a Phase 7 hardening item.

Phase 7 work was not started as part of this verification, per instruction.
