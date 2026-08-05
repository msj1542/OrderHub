// Drizzle schema — tables land per-phase as each domain is built:
//   Phase 1: users, companies, roles
//   Phase 2: products, materials, rolls, prices
//   Phase 3: orders, order_lines, comments
//   Phase 4: production_work_orders, qc_results
//   Phase 5: cancellation_requests, invoices
//   Phase 6: resources, notifications, audit_log, settings
//
// Kept as one file per REBUILD_PLAN.md file structure; split into
// per-domain files under lib/db/ only if it grows unwieldy.
export {};
