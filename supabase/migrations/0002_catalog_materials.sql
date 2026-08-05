-- ══════════════════════════════════════════════════════════════
-- Phase 2: Catalog & materials
-- Tables: materials, material_roll_widths, products,
--         product_materials, prices, product_files
-- RLS policies, Supabase Storage bucket, seed data
-- ══════════════════════════════════════════════════════════════

-- ── materials ─────────────────────────────────────────────────
CREATE TABLE public.materials (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── material_roll_widths ──────────────────────────────────────
CREATE TABLE public.material_roll_widths (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  width_in      NUMERIC(8,4) NOT NULL,
  length_ft     NUMERIC(8,4) NOT NULL DEFAULT 100,
  roll_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
  handling_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (material_id, width_in, length_ft)
);

-- ── products ──────────────────────────────────────────────────
CREATE TABLE public.products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                   TEXT NOT NULL UNIQUE,
  brand                 TEXT NOT NULL,
  model                 TEXT NOT NULL,
  year_start            TEXT,
  part_name             TEXT NOT NULL,
  attr1                 TEXT,
  attr2                 TEXT,
  description           TEXT NOT NULL,
  included_pieces       TEXT,
  version               TEXT,
  pattern_length_in     NUMERIC(8,4),
  required_roll_width_in NUMERIC(8,4),
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  customer_visible      BOOLEAN NOT NULL DEFAULT true,
  source_reference      TEXT,
  thumbnail_path        TEXT,
  price_list_revision   TEXT,
  price_effective_date  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── product_materials (compatibility) ────────────────────────
CREATE TABLE public.product_materials (
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, material_id)
);

-- ── prices ────────────────────────────────────────────────────
CREATE TABLE public.prices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id    UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  unit_price     NUMERIC(12,2) NOT NULL,
  effective_date TEXT NOT NULL,
  revision       TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── product_files ─────────────────────────────────────────────
CREATE TABLE public.product_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  mime_type   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_thumbnail BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.materials           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_roll_widths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_files       ENABLE ROW LEVEL SECURITY;

-- ── RLS: materials ────────────────────────────────────────────
-- All authenticated users can read active materials.
CREATE POLICY "materials_select_authenticated"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

-- Only internal users can write materials.
CREATE POLICY "materials_write_internal"
  ON public.materials FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── RLS: material_roll_widths ─────────────────────────────────
CREATE POLICY "roll_widths_select_authenticated"
  ON public.material_roll_widths FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "roll_widths_write_internal"
  ON public.material_roll_widths FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── RLS: products ─────────────────────────────────────────────
-- Internal users see all products (including inactive).
CREATE POLICY "products_select_internal"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- External users see only active + customer_visible products.
CREATE POLICY "products_select_external"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    NOT public.is_internal_user()
    AND is_active = true
    AND customer_visible = true
  );

CREATE POLICY "products_write_internal"
  ON public.products FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── RLS: product_materials ────────────────────────────────────
CREATE POLICY "product_materials_select_authenticated"
  ON public.product_materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_materials_write_internal"
  ON public.product_materials FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── RLS: prices ───────────────────────────────────────────────
-- Internal users always see prices.
CREATE POLICY "prices_select_internal"
  ON public.prices FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- External users see prices only if their company has pricing_visible = true.
CREATE POLICY "prices_select_external"
  ON public.prices FOR SELECT
  TO authenticated
  USING (
    NOT public.is_internal_user()
    AND EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.users u ON u.company_id = c.id
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND c.pricing_visible = true
    )
  );

CREATE POLICY "prices_write_internal"
  ON public.prices FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── RLS: product_files ────────────────────────────────────────
CREATE POLICY "product_files_select_authenticated"
  ON public.product_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_files_write_internal"
  ON public.product_files FOR ALL
  TO authenticated
  USING  (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

-- ── Supabase Storage: product-files bucket ────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-files',
  'product-files',
  false,
  52428800,  -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf',
        'application/zip','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can read product files.
CREATE POLICY "product_files_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-files');

-- Only internal users can upload product files.
CREATE POLICY "product_files_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-files'
    AND public.is_internal_user()
  );

CREATE POLICY "product_files_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-files'
    AND public.is_internal_user()
  );

-- ── Seed: materials & roll widths ─────────────────────────────
-- Materials: Gloss PPF and Matte PPF
INSERT INTO public.materials (id, code, name, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Gloss', 'Gloss PPF', true),
  ('00000000-0000-0000-0000-000000000002', 'Matte', 'Matte PPF', true)
ON CONFLICT (code) DO NOTHING;

-- Roll widths from reference app bootstrap seed
INSERT INTO public.material_roll_widths (material_id, width_in, length_ft, roll_cost, handling_cost, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 18, 100, 750.00,  25.00,  true),  -- Gloss 18"
  ('00000000-0000-0000-0000-000000000001', 24, 100, 1000.00, 27.50,  true),  -- Gloss 24"
  ('00000000-0000-0000-0000-000000000002', 18, 100, 937.50,  25.00,  true)   -- Matte 18"
ON CONFLICT (material_id, width_in, length_ft) DO NOTHING;
