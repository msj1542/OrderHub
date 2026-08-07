-- =============================================================
-- Phase 7 hardening: fix orders/order_lines/order_comments RLS
-- own-scope gap.
--
-- Background: the Phase 3 "_select_external" policies on these 3
-- tables implemented company-only scoping. The app layer's
-- orderScopeCondition() (lib/orders/service.ts) additionally
-- restricts external users at companies with order_scope='own' to
-- only their own orders (company_id AND created_by_user_id match).
-- Since Drizzle's service-role connection bypasses RLS entirely,
-- this was zero live impact — but it's a real gap if these tables
-- ever gain Realtime or direct PostgREST access. Fixing it now,
-- proactively, per REBUILD_PLAN.md Phase 7 "hardening" objectives.
--
-- This migration makes the 3 policies mirror orderScopeCondition()
-- exactly: internal sees all (unchanged); external sees company_id
-- match, additionally restricted to created_by_user_id match when
-- companies.order_scope = 'own'.
-- =============================================================

-- Helper: the caller's own company's order_scope ('own' | 'company').
-- Mirrors current_company_id()/current_app_user_id() (0001_auth_identity.sql):
-- SECURITY DEFINER so it can read companies.order_scope regardless of the
-- caller's own RLS visibility into that row.
CREATE OR REPLACE FUNCTION public.current_order_scope()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT c.order_scope FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.auth_user_id = auth.uid() AND u.is_active = true
  LIMIT 1;
$$;

-- ── orders ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_select_external" ON public.orders;

CREATE POLICY "orders_select_external"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND company_id = public.current_company_id()
    AND (
      public.current_order_scope() IS DISTINCT FROM 'own'
      OR created_by_user_id = public.current_app_user_id()
    )
  );

-- ── order_lines ───────────────────────────────────────────────
DROP POLICY IF EXISTS "order_lines_select_external" ON public.order_lines;

CREATE POLICY "order_lines_select_external"
  ON public.order_lines FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = public.current_company_id()
        AND (
          public.current_order_scope() IS DISTINCT FROM 'own'
          OR created_by_user_id = public.current_app_user_id()
        )
    )
  );

-- ── order_comments ────────────────────────────────────────────
DROP POLICY IF EXISTS "order_comments_select_external" ON public.order_comments;

CREATE POLICY "order_comments_select_external"
  ON public.order_comments FOR SELECT
  TO authenticated
  USING (
    NOT is_internal_user()
    AND is_internal = false
    AND order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = public.current_company_id()
        AND (
          public.current_order_scope() IS DISTINCT FROM 'own'
          OR created_by_user_id = public.current_app_user_id()
        )
    )
  );
