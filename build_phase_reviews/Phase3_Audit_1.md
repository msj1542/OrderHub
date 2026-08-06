Phase 3 Audit vs. REBUILD_PLAN.md
Commit verified: 16c3c97 pushed to origin/main. All Phase 3 work is on remote.

Items the user asked about specifically
Item	Status	Detail
New Order builder (catalog search, line items, custom items, expedited)	✅ Built	All four features implemented in components/orders/new-order.tsx. Catalog search filters live by brand/model/SKU/part. Line cards have material select + quantity. Custom item form captures description/brand/model/year/coverage/material. Expedited toggle + date picker. Rush fee shows in summary.
Reorder mode	⚠️ Phase 5 deferral	NewOrder accepts prefillLines/prefillCompanyId props but there's no entry point, no ?reorder_from= param in new/page.tsx, and no service logic to load existing lines. Per REBUILD_PLAN.md, reorder belongs to Phase 5 ("supplemental & reorder"). The props are scaffolding only.
Supplemental orders	⚠️ Phase 5 deferral	?supplemental_to= URL param is wired through new/page.tsx → <NewOrder supplementalToOrderId> and the orders table has the FK column. But the service does not validate/enforce parent-order constraints, and there's no "Add Supplemental" button on order detail. Per REBUILD_PLAN.md Phase 5. Schema is ready.
QC modal	⚠️ Phase 4 deferral	canQC prop exists in OrderActions but no button renders for it. QC is explicitly Phase 4 scope per REBUILD_PLAN.md ("Work orders, production queue, piece tally, re-cuts, QC").
Release modal	⚠️ Partial + bug	A simple ConfirmDialog is built for release. However, the Release button is wired through acceptOrderAction(id, "release") which silently ignores the "release" param and calls acceptOrder() — the accept transition. A fulfillment-completed order is NOT in submitted status, so clicking Release will throw "This order cannot be accepted" at runtime. Full release flow (gated by invoice verification) is Phase 5.
Invoice verification modal	⚠️ Phase 5 deferral	canInvoice prop exists in OrderActions but no button renders. Explicitly Phase 5.
Server-side list pagination	⚠️ Phase 7 deferral	listOrders loads all rows; OrdersWorkspace filters client-side. Per REBUILD_PLAN.md, "pagination" is explicitly Phase 7 — Hardening. Same pattern as the catalog.
Additional gaps found in audit
Bug 1 — acceptOrderAction ignores its action param (real, affects Claim + Release + Close)
app/(app)/orders/actions.ts declares action: "accept" | "claim" | "release" | "close" but always calls acceptOrder(), which hardcodes assertCanTransition("accept", ...). Result at runtime:

Accept button — works correctly.
Claim button — calls acceptOrderAction(id, "claim") → acceptOrder() → assertCanTransition("accept", "accepted") → will succeed but perform the wrong transition (accept instead of claim). Actually, accepted is a valid from-state for claim, not accept — so it will throw "This order cannot be accepted." Visible error to internal staff.
Release and Close — same problem, will throw at runtime with a misleading "cannot be accepted" error.
claim, release, and close need dedicated service functions (Phase 4/5 respectively), but right now clicking those buttons fails with a confusing error. The buttons appear for users with order:claim, order:release, order:close permissions — which includes internal_admin.

Recommendation: Either stub the action cleanly (return { error: "Not yet implemented" } per action type) or remove the Claim/Release/Close buttons until Phase 4/5 implements them. Leaving them visually present with a runtime error is worse than not showing them.

Gap 2 — No scope tabs in orders workspace
The checklist item says "Orders workspace (scope tabs, filters, search, table)." What's built has status filter chips and search, but no scope tabs. The reference app lets internal coordinators switch between views (e.g., all orders vs. orders awaiting their attention). The listOrders service already supports status filter; adding a scope tab for internal users (e.g., "Needs My Action") would be a future layer, but it's listed as in-scope for the workspace.

This is a mild gap — the data scoping (who sees what rows) is correct. The missing piece is a UI tab that pre-filters to a role-relevant subset. Given Phase 3's narrow scope description doesn't call this out explicitly, it's acceptable to defer to Phase 4 or Phase 5 when the full workspace polish occurs.

Items fully in scope and confirmed built correctly
Item	Verified
Order schema (6 tables + application_settings + order_number_seq)	✅
Migration 0003_orders.sql applied to production	✅
submitOrder() + duplicate-PO check + window config	✅
Draft save (no order number until submit)	✅
Order status machine (10 transitions × authz action)	✅
Orders workspace (search, filter chips, URL ?id= selection)	✅
Order detail (header, lines, totals, notes)	✅
Comment composer (customer-visible vs. internal)	✅
Accept order (with expected completion date)	✅
Cancel order (with reason, coordinator-only)	✅
Request cancellation (external, reason required)	✅
Decline cancellation request	✅
Delete draft (with audit log)	✅
Dashboard stat cards (scoped counts)	✅
assertNotPreview() on all write actions	✅
computeExpectedCompletion (week-anchored algorithm)	✅
computeRushFee	✅
ConfirmDialog + MasterDetail UI primitives	✅
64 tests, all passing	✅
Summary: what needs action before Phase 4
Fix or stub the Claim/Release/Close buttons — they're wired to the wrong service function and will confuse testing. Easiest fix is to add dispatch logic in acceptOrderAction or remove those buttons until Phase 4/5 implements the backing service calls.
Everything else is either correctly built or an explicit plan-level deferral to a later phase.