-- ══════════════════════════════════════════════════════════════
-- Phase 6: Resources, notifications, settings, Realtime
-- Tables: notifications, notification_reads, resource_categories,
--         resources, resource_versions
-- Adds: companies profile/billing columns, "resources" Storage bucket,
--       authenticated-role SELECT RLS for Realtime, Realtime publication
-- ══════════════════════════════════════════════════════════════

-- ── companies: profile + billing fields ──────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email        TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS billing_notes        TEXT;

-- ── notifications ─────────────────────────────────────────────
-- user_id NULL + company_id NULL  = internal-only broadcast
-- user_id NULL + company_id set   = broadcast to that company's users (+ all internal)
-- user_id set                     = targeted to one user
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.users(id),
  company_id UUID REFERENCES public.companies(id),
  order_id   UUID REFERENCES public.orders(id),
  event      TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx    ON public.notifications(user_id);
CREATE INDEX notifications_company_idx ON public.notifications(company_id);
CREATE INDEX notifications_created_idx ON public.notifications(created_at DESC);

-- Read tracking is per-user (a broadcast notification can be read by many
-- users independently) rather than a single boolean column on the row.
CREATE TABLE public.notification_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id),
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE INDEX notification_reads_user_idx ON public.notification_reads(user_id);

-- ── resource_categories ───────────────────────────────────────
CREATE TABLE public.resource_categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL UNIQUE,
  pricing_restricted BOOLEAN NOT NULL DEFAULT false,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── resources (document library entries) ──────────────────────
CREATE TABLE public.resources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID NOT NULL REFERENCES public.resource_categories(id),
  product_id          UUID REFERENCES public.products(id),
  title               TEXT NOT NULL,
  description         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  customer_visible    BOOLEAN NOT NULL DEFAULT true,
  pricing_restricted  BOOLEAN NOT NULL DEFAULT false,
  current_version_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── resource_versions (uploaded files per resource) ────────────
CREATE TABLE public.resource_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id  UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  version      TEXT,
  file_path    TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  mime_type    TEXT,
  uploaded_by  UUID NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resources
  ADD CONSTRAINT resources_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.resource_versions(id);

CREATE INDEX resource_versions_resource_idx ON public.resource_versions(resource_id);
CREATE INDEX resources_category_idx         ON public.resources(category_id);

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_versions   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS for app-layer scoping (Drizzle connection).
CREATE POLICY "service_role_all_notifications"       ON public.notifications       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_notification_reads"  ON public.notification_reads  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_resource_categories" ON public.resource_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_resources"           ON public.resources           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_resource_versions"   ON public.resource_versions   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── RLS: notifications (authenticated) ──────────────────────────
-- These policies are the ACTUAL access boundary for Realtime subscriptions
-- (the browser client connects as `authenticated` with the user's own JWT,
-- unlike app reads which go through the service-role Drizzle connection).
-- Permissive policies for the same command are OR'd together by Postgres.

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY "notifications_select_broadcast_internal"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL AND public.is_internal_user());

CREATE POLICY "notifications_select_broadcast_company"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL AND company_id = public.current_company_id());

CREATE POLICY "notification_reads_select_own"
  ON public.notification_reads FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

-- ── RLS: resources (authenticated) ──────────────────────────────
CREATE POLICY "resource_categories_select_authenticated"
  ON public.resource_categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "resources_select_internal"
  ON public.resources FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "resources_select_external"
  ON public.resources FOR SELECT TO authenticated
  USING (
    NOT public.is_internal_user()
    AND is_active = true
    AND customer_visible = true
    AND (
      pricing_restricted = false
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = public.current_company_id() AND c.pricing_visible = true
      )
    )
  );

CREATE POLICY "resource_versions_select_authenticated"
  ON public.resource_versions FOR SELECT TO authenticated
  USING (true);

-- ── RLS: production tables (authenticated) — Realtime for the queue ──
-- Only internal staff ever view the production queue / work-order section;
-- external users have no use case for these rows.
CREATE POLICY "production_work_orders_select_internal"
  ON public.production_work_orders FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "production_line_progress_select_internal"
  ON public.production_line_progress FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- ── Supabase Storage: resources bucket ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  false,
  52428800,  -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf',
        'application/zip','application/octet-stream',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "resources_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resources');

CREATE POLICY "resources_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resources' AND public.is_internal_user());

CREATE POLICY "resources_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resources' AND public.is_internal_user());

-- ── Realtime: publication + replica identity ────────────────────
-- REPLICA IDENTITY FULL so UPDATE events carry old row values (piece-tally
-- progress updates on production_line_progress).
ALTER TABLE public.production_work_orders   REPLICA IDENTITY FULL;
ALTER TABLE public.production_line_progress REPLICA IDENTITY FULL;
ALTER TABLE public.notifications            REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.production_work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_line_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── Seed: resource categories (from reference app's document library) ──
INSERT INTO public.resource_categories (name, pricing_restricted, sort_order) VALUES
  ('Price Lists',          true,  1),
  ('Install Instructions', false, 2),
  ('Diagrams',             false, 3),
  ('Product Images',       false, 4)
ON CONFLICT (name) DO NOTHING;
