-- =============================================================
-- Phase 3: Orders
-- Tables: application_settings, orders, order_lines,
--         order_comments, order_status_history,
--         cancellation_requests, audit_log
-- =============================================================

-- ── application_settings ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.application_settings (
  key          text PRIMARY KEY,
  value        text NOT NULL,
  modified_by  uuid REFERENCES public.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_internal"
  ON public.application_settings FOR SELECT
  TO authenticated
  USING (is_internal_user());

CREATE POLICY "settings_update_admin"
  ON public.application_settings FOR UPDATE
  TO authenticated
  USING (is_internal_user())
  WITH CHECK (is_internal_user());

-- ── order_number sequence ─────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

-- ── orders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            text UNIQUE,
  company_id              uuid NOT NULL REFERENCES public.companies(id),
  created_by_user_id      uuid NOT NULL REFERENCES public.users(id),
  status                  text NOT NULL DEFAULT 'draft',
  is_expedited            boolean NOT NULL DEFAULT false,
  requested_date          text,
  expected_completion_date text,
  po_number               text,
  supplemental_to_order_id uuid REFERENCES public.orders(id),
  customer_notes          text,
  internal_notes          text,
  subtotal                numeric(12,2) NOT NULL DEFAULT 0,
  rush_fee                numeric(12,2) NOT NULL DEFAULT 0,
  adjustment              numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_reason       text,
  grand_total             numeric(12,2) NOT NULL DEFAULT 0,
  cancellation_requested  boolean NOT NULL DEFAULT false,
  submitted_at            timestamptz,
  accepted_at             timestamptz,
  released_at             timestamptz,
  closed_at               timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Internal users see all orders
CREATE POLICY "orders_select_internal"
  ON public.orders FOR SELECT
  TO authenticated
  USING (is_internal_user());

-- External users see their company's orders (own-scope check done in app code)
-- NOTE: This policy implements company-only scoping. The app layer enforces
-- own-scope via orderScopeCondition(). If a future phase adds Realtime or
-- PostgREST access to these tables, tighten this RLS to match
-- orderScopeCondition() before enabling those features.
CREATE POLICY "orders_select_external"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND company_id = (
      SELECT company_id FROM public.users
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "orders_insert_authenticated"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "orders_update_authenticated"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── order_lines ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id           uuid REFERENCES public.products(id),
  material_id          uuid REFERENCES public.materials(id),
  sku_snapshot         text NOT NULL,
  description_snapshot text NOT NULL,
  attributes_snapshot  text,
  quantity             integer NOT NULL,
  unit_price           numeric(12,2),
  line_total           numeric(12,2),
  pricing_status       text NOT NULL DEFAULT 'priced',
  is_custom            boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_lines_select_internal"
  ON public.order_lines FOR SELECT
  TO authenticated
  USING (is_internal_user());

-- Company-only scoping (own-scope check done in app code).
-- NOTE: The app layer enforces own-scope via orderScopeCondition(). If a
-- future phase adds Realtime or PostgREST access to this table, tighten
-- this RLS to match orderScopeCondition() before enabling those features.
CREATE POLICY "order_lines_select_external"
  ON public.order_lines FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = (
        SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "order_lines_insert_authenticated"
  ON public.order_lines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "order_lines_delete_authenticated"
  ON public.order_lines FOR DELETE
  TO authenticated
  USING (true);

-- ── order_comments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  body        text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Internal users see all comments; external users only see non-internal comments
CREATE POLICY "order_comments_select_internal"
  ON public.order_comments FOR SELECT
  TO authenticated
  USING (is_internal_user());

-- Company-only scoping (own-scope check done in app code).
-- NOTE: The app layer enforces own-scope via orderScopeCondition(). If a
-- future phase adds Realtime or PostgREST access to this table, tighten
-- this RLS to match orderScopeCondition() before enabling those features.
CREATE POLICY "order_comments_select_external"
  ON public.order_comments FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND is_internal = false
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = (
        SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "order_comments_insert_authenticated"
  ON public.order_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── order_status_history ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status      text NOT NULL,
  changed_by      uuid NOT NULL REFERENCES public.users(id),
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_history_select_internal"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (is_internal_user());

CREATE POLICY "order_status_history_insert_authenticated"
  ON public.order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── cancellation_requests ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES public.users(id),
  reason               text,
  status               text NOT NULL DEFAULT 'pending',
  resolved_by_user_id  uuid REFERENCES public.users(id),
  resolved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellation_requests_select_internal"
  ON public.cancellation_requests FOR SELECT
  TO authenticated
  USING (is_internal_user());

CREATE POLICY "cancellation_requests_select_external"
  ON public.cancellation_requests FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = (
        SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "cancellation_requests_insert_authenticated"
  ON public.cancellation_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cancellation_requests_update_internal"
  ON public.cancellation_requests FOR UPDATE
  TO authenticated
  USING (is_internal_user())
  WITH CHECK (is_internal_user());

-- ── audit_log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.users(id),
  company_id     uuid REFERENCES public.companies(id),
  order_id       uuid REFERENCES public.orders(id),
  entity_type    text NOT NULL,
  entity_id      text,
  action         text NOT NULL,
  previous_value text,
  new_value      text,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_internal_admin"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.role_code = u.role_code
      WHERE u.auth_user_id = auth.uid()
        AND r.role_code = 'internal_admin'
    )
  );

CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── Seed application_settings ─────────────────────────────────
INSERT INTO public.application_settings (key, value) VALUES
  ('business_timezone',   'America/Chicago'),
  ('rush_fee_mode',       'percentage'),
  ('rush_fee_value',      '20'),
  ('cutoff_weekday',      'Monday'),
  ('cutoff_time',         '12:00'),
  ('completion_weekday',  'Friday'),
  ('completion_time',     '15:30'),
  ('duplicate_window_days', '3')
ON CONFLICT (key) DO NOTHING;
