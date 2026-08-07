Two fixes applied:

supabase/migrations/0003_orders.sql — added NOTE: comments to all three affected policies (orders, order_lines, order_comments) documenting the company-only-vs-own-scope RLS gap. Comment-only, no re-migration needed.
components/production/production-queue.tsx — "Print Labels" now also shows for released work orders.
123/123 tests still pass. Committed and pushed as rebuild: Phase 7 prep (RLS doc note + label reprint for released WOs).