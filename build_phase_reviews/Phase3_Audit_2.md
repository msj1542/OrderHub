Pushed. Here's what changed:

app/(app)/orders/actions.ts — acceptOrderAction now dispatches on action:

"accept" → acceptOrder() (unchanged, real implementation)
"claim" → returns { message: "Order claimed. QC workflow available in Phase 4." }
"release" → returns { message: "Release queued. Invoice verification required (Phase 5)." }
"close" → returns { message: "Close queued. Full lifecycle available in Phase 5." }
components/orders/order-actions.tsx — run() now handles the message field: stubs close the dialog and show an info-colored message inline rather than triggering a page refresh or swallowing the result silently. The Result type also got a message?: string field.

64/64 tests still pass. Phase 3 is clean.