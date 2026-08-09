-- Compatibility matrix (item 6, 2026-08-09 feature pass): a kit SKU can fit
-- multiple vehicle model/years and a model/year draws from multiple SKUs —
-- genuinely many-to-many, so this needs its own tables rather than reusing
-- products.brand/model/year_start (which only holds one representative
-- fitment per product row). Source data: scripts/import-vehicle-fitments.mjs.

CREATE TABLE public.vehicle_models (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL,
  model      TEXT NOT NULL,
  year_start TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_vehicle_fitments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vehicle_model_id  UUID NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  UNIQUE (product_id, vehicle_model_id)
);

CREATE INDEX product_vehicle_fitments_product_idx ON public.product_vehicle_fitments(product_id);
CREATE INDEX product_vehicle_fitments_model_idx   ON public.product_vehicle_fitments(vehicle_model_id);

ALTER TABLE public.vehicle_models          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_vehicle_fitments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS for app-layer scoping (Drizzle connection),
-- matching every other table's policy in this schema.
CREATE POLICY "service_role_all_vehicle_models"           ON public.vehicle_models           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_product_vehicle_fitments"  ON public.product_vehicle_fitments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public catalog data (same visibility as products/materials) — every
-- authenticated user can read the compatibility matrix.
CREATE POLICY "vehicle_models_select_authenticated"
  ON public.vehicle_models FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "product_vehicle_fitments_select_authenticated"
  ON public.product_vehicle_fitments FOR SELECT TO authenticated
  USING (true);
