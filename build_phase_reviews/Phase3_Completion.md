Phase 3 complete — Orders Core
Files created / modified
Schema & migration

lib/db/schema.ts — 6 new tables: orders, order_lines, order_comments, order_status_history, cancellation_requests, audit_log; + application_settings; new types: OrderStatus, ORDER_STATUS_LABELS, OrderSummary, OrderFull
supabase/migrations/0003_orders.sql — DDL, RLS policies (read-own-company + internal-all), order_number_seq sequence, default application_settings seed

Service / lib

lib/orders/statusMachine.ts — TRANSITIONS map (10 actions × fromStatuses + authzAction + toStatus); getTransition(), assertCanTransition()
lib/orders/duplicate.ts — checkDuplicatePO() with configurable windowDays + excludeOrderId
lib/orders/service.ts — full order service:
  listOrders(user, filters) — scoped list with company/creator joins
  getOrder(id, user) — full order + lines + comments (filtered by isInternal) + pending cancel
  saveOrSubmitOrder(user, input, mode) — line validation, price resolution, totals, duplicate PO check, nextval order number, db.transaction(), status history + audit log
  deleteDraft(), addComment(), acceptOrder(), requestCancellation(), cancelOrder(), declineCancellation(), getDashboardCounts()
lib/settings/schedule.ts — getSettings() (reads DB, env fallback), computeExpectedCompletion() (cutoff-week algorithm), computeRushFee()
lib/settings/tz.ts — formatInTz(), todayInTz(), parseDateStr(), toDateStr()

Pages & server actions

app/(app)/orders/page.tsx — orders workspace RSC with MasterDetail layout; URL ?id= param for selection
app/(app)/orders/new/page.tsx — RSC loads products/materials/companies for new-order form
app/(app)/dashboard/page.tsx — real dashboard with getDashboardCounts(), role-conditional stat cards, quick action links
app/(app)/orders/actions.ts — acceptOrderAction, cancelOrderAction, requestCancellationAction, declineCancellationAction, deleteDraftAction, addCommentAction (all assertNotPreview())
app/(app)/orders/new/actions.ts — saveOrderAction, submitOrderAction; bubbles duplicate_order structured response

UI components

components/ui/confirm-dialog.tsx — ConfirmDialog wrapping Dialog; variant danger|primary, async onConfirm, children slot
components/ui/master-detail.tsx — responsive list+detail split; mobile shows one panel at a time
components/orders/orders-workspace.tsx — client; search + status filter chips; URL-synced selection
components/orders/order-detail.tsx — header, cancellation banner, OrderActions, info grid, line items table, totals, notes, comment thread + CommentComposer
components/orders/order-actions.tsx — all action buttons gated by can* props; ConfirmDialog for destructive actions; date input for accept
components/orders/comment-composer.tsx — client; FormData-based addCommentAction; internal toggle for staff

Tests

lib/orders/statusMachine.test.ts — 20+ tests: valid chain, cancellation paths, delete_draft, authzAction values
lib/orders/duplicate.test.ts — 6 unit tests of pure duplicate-finding logic
lib/settings/schedule.test.ts — 9 tests: computeExpectedCompletion (5 cases), computeRushFee (4 cases)

All 64 tests pass.

Key decisions made

- computeExpectedCompletion uses "current work-week's Friday" anchored to cutoff weekday, then +7 if past cutoff. Business rule: only orders placed on the cutoff weekday before the cutoff TIME get "this week." All other weekdays (Wednesday, Friday, Saturday) are past the Monday noon cutoff → next week.
- External comment visibility: isInternal=true rows excluded at query level for external users.
- Order number format: OH-{YYYY}-{seq padded to 5}, generated with nextval('order_number_seq') inside transaction.
- All service writes use db.transaction(); status changes record order_status_history + audit_log rows.
- Duplicate PO window: configurable (default 3 days), skips draft status and self-exclusion.
- Rush fee: configurable percentage/flat/disabled; computed at submit time from subtotal.
