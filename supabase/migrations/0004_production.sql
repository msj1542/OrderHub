-- Phase 4: Production queue tables

CREATE TABLE IF NOT EXISTS production_work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending',
  due_date            TEXT,
  claimed_by_user_id  UUID REFERENCES users(id),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  released_at         TIMESTAMPTZ,
  canceled_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_line_progress (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id    UUID NOT NULL REFERENCES production_work_orders(id) ON DELETE CASCADE,
  order_line_id    UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  completed_pieces TEXT NOT NULL DEFAULT '[]',
  modified_by      UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, order_line_id)
);

CREATE TABLE IF NOT EXISTS production_recuts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id         UUID NOT NULL REFERENCES production_work_orders(id) ON DELETE CASCADE,
  order_line_id         UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  quantity              INTEGER NOT NULL,
  reason                TEXT NOT NULL,
  material_usage_inches NUMERIC(10, 4),
  recorded_by           UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qc_attestations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES production_work_orders(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  answers       TEXT NOT NULL,
  notes         TEXT,
  attested      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS production_work_orders_status_idx   ON production_work_orders(status);
CREATE INDEX IF NOT EXISTS production_line_progress_wo_idx     ON production_line_progress(work_order_id);
CREATE INDEX IF NOT EXISTS production_recuts_wo_idx            ON production_recuts(work_order_id);
CREATE INDEX IF NOT EXISTS qc_attestations_wo_idx              ON qc_attestations(work_order_id);

-- RLS
ALTER TABLE production_work_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_line_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_recuts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_attestations           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_production_work_orders"
  ON production_work_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_production_line_progress"
  ON production_line_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_production_recuts"
  ON production_recuts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_qc_attestations"
  ON qc_attestations FOR ALL TO service_role USING (true) WITH CHECK (true);
