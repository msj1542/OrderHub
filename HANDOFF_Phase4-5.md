# Phase 4 → Phase 5 Handoff

## Phase 4 Summary

Phase 4 implemented the Production Queue: schema (work orders, line progress, recuts, QC attestations), work order creation on order accept, fulfillment queue UI, piece-by-piece completion tally, non-billable recut recording, QC attestation, and print work order / labels (QR-coded, SHA-256 trace).

Phase 4 audit fixes (committed after audit):
- Print Labels button now available in all active statuses: `pending`, `in_progress`, `completed`, `awaiting_pickup`
- Work Order section added to order detail (internal users only): status, assigned user, due date, piece progress summary, Print Work Order / Print Labels links

## Formal Deferrals

**Realtime (Supabase Realtime) deferred to Phase 6.** Production queue currently uses `router.refresh()` on action completion; polling/manual refresh is acceptable for MVP. Phase 6 will add Supabase Realtime subscriptions so multiple fulfillment staff see piece progress and status changes without refreshing.

**Production queue search deferred to Phase 7 hardening.** Current tab + status filtering is sufficient for MVP. Phase 7 will add text search by order number or company name.

## Phase 5 Scope (planned)

Per REBUILD_PLAN.md Phase 5: Release, Invoice Verification, and Close flow.
- `releaseOrder` service function (internal: transitions `fulfillment_completed → ready_for_pickup`)
- `invoiceOrder` service function (invoice verification modal: SKU/qty/total match or documented discrepancy reason)
- `closeOrder` service function
- Invoice verification modal UI
- Release + close action buttons wired to real service functions (Phase 4 stubs in `actions.ts` return friendly messages)

## Known Stubs in Phase 4 (to replace in Phase 5)

In `app/(app)/orders/actions.ts`:
```ts
case "release": return { success: true, message: "Release queued. Verification in Phase 5" };
case "close":   return { success: true, message: "Close queued. Phase 5" };
```

## Migration State

`supabase/migrations/0004_production.sql` — applied to production Supabase.

Tables added: `production_work_orders`, `production_line_progress`, `production_recuts`, `qc_attestations`.
