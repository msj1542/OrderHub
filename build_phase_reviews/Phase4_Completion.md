Phase 4 — What was built

Schema (lib/db/schema.ts)

4 new tables: productionWorkOrders, productionLineProgress, productionRecuts, qcAttestations

Relations for all 4 tables (+ workOrder on ordersRelations)

7 new TypeScript types: WorkOrderStatus, WorkOrderSummary, WorkOrderFull, WorkOrderLineFull, plus the 4 row types

Migration (supabase/migrations/0004\_production.sql)

DDL for all 4 tables with FK constraints

UNIQUE (work\_order\_id, order\_line\_id) on production\_line\_progress

RLS enabled; service-role policy on all tables

Service layer

lib/orders/service.ts (modified):



acceptOrder → now creates a production\_work\_orders row (status pending, dueDate from expectedCompletionDate) inside the same transaction

claimOrder → new function: transitions order accepted→in\_fulfillment, updates work order pending→in\_progress, records status history and audit log

getDashboardCounts → adds pendingWorkOrderCount for internal users

lib/production/service.ts (new):



listWorkOrders(user, tab) — scoped list with tab filter (current/completed/archived/all), piece counts

getWorkOrder(id, user) — full detail with lines, progress arrays, recuts

claimWorkOrder(workOrderId, user) — delegates to claimOrder via order ID lookup

updatePieceProgress(woId, lineId, completedPieces\[], user) — check-then-upsert, validates piece numbers in range

recordRecut(woId, lineId, qty, reason, user) — validates, computes (patternLengthIn + 1) × qty material usage

submitQC(woId, answers, notes, user) — validates all 3 QC keys are true, inserts qcAttestations, transitions work order to completed and order to fulfillment\_completed

Auth policy (lib/authz/policy.ts)

Added order:claim to ORDER\_COORDINATOR role (matches reference: coordinators can claim/start work orders)

Server actions

app/(app)/orders/actions.ts — claim stub replaced with real claimOrder() call

app/(app)/production/actions.ts (new) — claimWorkOrderAction, updatePieceProgressAction, recordRecutAction, submitQCAction (all with assertNotPreview)

UI

app/(app)/production/page.tsx — real RSC replacing placeholder; loads work orders, passes can\* props down

components/production/production-queue.tsx — tabs (Current Work / Completed On Site / Released Archived / All), expandable work order rows, inline piece checkboxes (≤45 individual numbered squares; >45 batched-5 groups), action buttons (Begin Production, Print Work Order, Print Labels, Finalize Production, Record Non-Billable Re-cut)

components/production/qc-modal.tsx — 3 QC checkboxes, attestation checkbox (unlocks only after all 3 checked), optional notes, disabled button until fully attested

components/production/recut-modal.tsx — line selector, quantity, reason, estimated material usage display

app/(app)/dashboard/page.tsx — added "Work Orders Pending" stat card for internal users with production:view

API routes

app/api/production/\[id]/detail/route.ts — GET returns full work order JSON (used by expanded rows to lazy-load)

app/api/production/\[id]/print/route.ts — GET ?type=work-order|labels; generates auto-printing HTML; labels use qrcode npm for SVG QR codes with SHA-256 trace codes (first 12 hex chars of ${workOrderId}:${lineId}:${seqNum}:${orderNumber}:original)

Tests (lib/production/service.test.ts) — 18 new tests

QC\_ITEMS constant validation (3 tests)

QC answer validation logic: all-pass, single-false, missing-key, empty (4 tests)

Material usage calculation: margin, custom items, proportionality (3 tests)

Piece progress validation: out-of-range filtering, dedup, sort (5 tests)

Work order status transition ordering (3 tests)

Total: 82/82 tests passing.



To apply migration to production Supabase, say the word and I'll run it. The migration adds 4 tables and is fully additive with no impact on existing data.

