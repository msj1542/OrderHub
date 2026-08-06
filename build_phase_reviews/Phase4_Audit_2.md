All done. 82/82 tests pass. Committed and pushed as rebuild: Phase 4 audit fixes (order↔production queue linkage).



Summary of what landed:



Fix 1 — production-queue.tsx: Print Labels now shows for pending, in\_progress, completed, and awaiting\_pickup (was only pending/in\_progress)

Fix 2 — New components/orders/work-order-section.tsx: server component rendering WO status pill, assigned user, due date, piece progress done/total (pct%), and Print Work Order / Print Labels anchor links (gated on order:print\_labels). Wired into order-detail.tsx before the comments section for internal users only. getOrder() now loads the associated work order via an alias join on claimed\_by + progress count aggregation. OrderFull type extended with workOrder: OrderWorkOrderBrief | null.

