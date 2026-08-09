-- Per-file external access control (item 4 of the 2026-08-09 feature pass):
-- a resource customers can see may additionally be marked view-only, so the
-- app never issues a download-flagged signed URL for it. A resource hidden
-- from customers entirely (customer_visible = false) is already "internal
-- only" — this column only matters when customer_visible = true.
ALTER TABLE public.resources
  ADD COLUMN downloadable BOOLEAN NOT NULL DEFAULT true;
