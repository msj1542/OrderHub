Phase 5 — What was built

Schema (lib/db/schema.ts)

1 new table: invoiceVerifications (orderId, userId, invoiceNumber, invoiceTotal, discrepancyReason, attested, createdAt)

Relations for invoiceVerifications (order, user)

2 new TypeScript types: InvoiceVerification, NewInvoiceVerification

Migration (supabase/migrations/0005_invoice_verification.sql)

DDL for invoice_verifications with FK to orders/users, index on order_id

RLS enabled; service-role policy (same pattern as Phase 3/4 tables)

Applied to production Supabase during this session.

Service layer

lib/orders/invoiceVerification.ts (new) — pure validation module, no DB import:

validateInvoiceVerification(input, grandTotal) — requires invoice number, non-negative invoice total, a discrepancy reason whenever the invoice total differs from the order's grand total by more than $0.005, and the attestation checkbox. Fixes audit issue #5 ("invoice '3 matches' are theater") — the UI shows the actual order lines and totals, and this function gates on one honest attestation instead of three checkboxes that were always true.

hasDiscrepancy(invoiceTotal, grandTotal) — shared tolerance check, also used by the modal to conditionally require/show the discrepancy field.

lib/orders/service.ts (modified) — 3 new functions, following the acceptOrder/claimOrder transactional pattern:

invoiceVerifyOrder(orderId, input, user) — role gate (order:invoice_verify) → status-machine gate (fulfillment_completed → ready_for_pickup) → pure validation → transaction: updates order status, work order to awaiting_pickup, inserts invoice_verifications row, order_status_history, audit_log.

releaseOrder(orderId, user) — order:release gate, ready_for_pickup → released, sets releasedAt on both order and work order (→ released), status history + audit log.

closeOrder(orderId, user) — order:close gate, released → closed, sets closedAt, status history + audit log.

Server actions

app/(app)/orders/actions.ts — the two stub arms ("Release queued. Invoice verification required (Phase 5)." / "Close queued...") replaced with real releaseOrder()/closeOrder() calls. New invoiceVerifyAction(orderId, input) added (requireUser + assertNotPreview, per the standard pattern).

UI

components/orders/invoice-verify-modal.tsx (new) — shows the real order lines (SKU/qty/total) and grand total, invoice number + invoice total inputs, a discrepancy-reason field that appears (and is required) only when the entered total doesn't match, and a single attestation checkbox whose label changes to acknowledge the documented discrepancy when one exists.

components/orders/order-actions.tsx — added the "Verify Invoice" button (fulfillment_completed status) wired to the new modal; added "Reorder" (any status except draft/canceled) and "Add Supplemental Order" (internal only, accepted-or-later, not itself already a supplemental order) buttons that route to /orders/new with the appropriate query param. Added canCreate prop.

components/orders/order-detail.tsx — passes canCreate={can(user, "order:create")} through to OrderActions.

Reorder / supplemental entry points

components/orders/new-order.tsx — exported the previously-internal CatalogLine/CustomLine/Line types so the server page can type prefill data.

app/(app)/orders/new/page.tsx — added reorder_from query param handling alongside the existing supplemental_to. buildPrefillLines() loads the source order (via the existing scoped getOrder()) and maps each line to the NewOrder builder's line shape: custom lines rehydrate brand/model/year/coverage/notes from attributesSnapshot; catalog lines re-resolve the live ProductWithMaterials object by ID from the already-loaded product list (so pricing/material options are current, not stale snapshot data) and are silently skipped if the product is no longer available. Reorder prefills both lines and company; supplemental prefills only company (a supplemental order is new line items against an existing order, not a copy of it).

Build-blocking fixes (pre-existing, not introduced this phase)

lib/production/constants.ts (new) — QC_ITEMS/QC_KEYS moved out of lib/production/service.ts into a pure, DB-import-free module. components/production/qc-modal.tsx was importing these from service.ts, which pulled the Postgres driver (node:tls, node:perf_hooks) into the client bundle and made npm run build fail unconditionally — confirmed present on the Phase 4 baseline commit (becf909) before any Phase 5 changes, not a regression introduced here. service.ts re-exports the constants for existing consumers (tests, server code).

components/ui/button.tsx — added asChild support (via @radix-ui/react-slot, already an installed dependency) so <Button asChild><Link>...</Link></Button> type-checks. app/(app)/orders/page.tsx already used this pattern for the "+ New Order" button; TypeScript build was failing on it since Button never declared the prop.

Both fixes were required to get npm run build passing at all — the app could not have been deployed in its Phase 4 state.

Tests (lib/orders/invoiceVerification.test.ts — new, 9 tests; lib/orders/statusMachine.test.ts — extended, +10 tests)

hasDiscrepancy: null total, within tolerance, beyond tolerance

validateInvoiceVerification: happy path, missing invoice number, missing attestation, mismatch without reason (fails), mismatch with reason (passes), null total (no reason required), negative total, non-finite total

statusMachine: release/close/invoice_verify from-status guards and toStatus values, authz action wiring for release/close

Total: 101/101 tests passing (was 82; +19).

Non-goals honored (per REBUILD_PLAN.md Phase 5 scope)

No resources, notifications, or Resend email work.

No settings UI changes.

No Realtime.

No search/pagination.

Known follow-ups

Reorder/supplemental silently drops a catalog line if the source product is no longer active/visible — no UI warning surfaces this. Acceptable for Phase 5; worth a toast/banner in a later polish pass.

invoiceVerifications has no admin-facing view yet (audit trail is queryable via audit_log/DB only) — consistent with "Full Settings hub / Audit History" being Phase 6 scope.

Browser E2E of the new flows (invoice verify → release → close, reorder, supplemental) was not performed — signing in requires entering a password into the login form, which is outside what an agent may do. Verified instead via: 101/101 unit tests, a clean production build (npm run build), and manual code review of the transaction logic against the existing accept/claim/cancel patterns it mirrors. Recommend a manual click-through before considering Phase 5 fully closed.
