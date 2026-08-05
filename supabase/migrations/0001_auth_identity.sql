-- ══════════════════════════════════════════════════════════════
-- Phase 1: Auth & identity
-- Tables: roles, companies, users
-- RLS policies, helper functions, triggers, seed roles
-- ══════════════════════════════════════════════════════════════

-- ── Roles lookup ──────────────────────────────────────────────
CREATE TABLE public.roles (
  role_code   TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT false
);

-- ── Companies (external customers) ───────────────────────────
CREATE TABLE public.companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  order_scope     TEXT NOT NULL DEFAULT 'own'
                    CHECK (order_scope IN ('own', 'company')),
  pricing_visible BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── App users (pre-created by admin, linked on first sign-in) ─
CREATE TABLE public.users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  role_code    TEXT NOT NULL REFERENCES public.roles(role_code),
  company_id   UUID REFERENCES public.companies(id),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- External users must belong to a company; internal users must not.
  CONSTRAINT external_requires_company CHECK (
    (role_code LIKE 'internal%' AND company_id IS NULL) OR
    (role_code LIKE 'external%' AND company_id IS NOT NULL)
  )
);

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;

-- ── Helper functions (SECURITY DEFINER — bypass RLS for self-lookup) ──
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT id FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role_code FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT company_id FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.role_code = u.role_code
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND r.is_internal = true
  );
$$;

-- ── RLS Policies: roles ───────────────────────────────────────
-- All authenticated users can read the roles table.
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- ── RLS Policies: companies ───────────────────────────────────
-- Internal staff see all companies.
CREATE POLICY "companies_select_internal"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- External users see only their own company.
CREATE POLICY "companies_select_own"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = public.current_company_id());

-- Only internal_admin can write companies.
CREATE POLICY "companies_write_internal_admin"
  ON public.companies FOR ALL
  TO authenticated
  USING  (public.current_role_code() = 'internal_admin')
  WITH CHECK (public.current_role_code() = 'internal_admin');

-- ── RLS Policies: users ───────────────────────────────────────
-- Internal staff see all users.
CREATE POLICY "users_select_internal"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- External users see everyone in their own company.
CREATE POLICY "users_select_own_company"
  ON public.users FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

-- Everyone can read their own row (needed before company_id is resolved).
CREATE POLICY "users_select_self"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- internal_admin can write any user.
CREATE POLICY "users_write_internal_admin"
  ON public.users FOR ALL
  TO authenticated
  USING  (public.current_role_code() = 'internal_admin')
  WITH CHECK (public.current_role_code() = 'internal_admin');

-- external_admin can manage users in their own company
-- (cannot create/promote other external_admins).
CREATE POLICY "users_write_external_admin"
  ON public.users FOR ALL
  TO authenticated
  USING (
    public.current_role_code() = 'external_admin'
    AND company_id = public.current_company_id()
    AND role_code != 'external_admin'
  )
  WITH CHECK (
    public.current_role_code() = 'external_admin'
    AND company_id = public.current_company_id()
    AND role_code != 'external_admin'
  );

-- ── Trigger: link auth.users → public.users on invite accepted ─
CREATE OR REPLACE FUNCTION public.handle_auth_user_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users
  SET    auth_user_id = NEW.id,
         updated_at   = now()
  WHERE  email        = NEW.email
    AND  auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_link();

-- ── updated_at auto-maintenance ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed: roles ────────────────────────────────────────────────
INSERT INTO public.roles (role_code, display_name, is_internal) VALUES
  ('internal_admin',     'Internal Admin',     true),
  ('order_coordinator',  'Order Coordinator',  true),
  ('fulfillment',        'Fulfillment',        true),
  ('accounting',         'Accounting',         true),
  ('external_admin',     'Company Admin',      false),
  ('external_ordering',  'Ordering User',      false),
  ('external_reference', 'Reference Only',     false);
