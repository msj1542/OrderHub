-- Phase 5: Invoice verification record

CREATE TABLE IF NOT EXISTS invoice_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  invoice_number      TEXT,
  invoice_total       NUMERIC(12, 2),
  discrepancy_reason  TEXT,
  attested            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_verifications_order_idx ON invoice_verifications(order_id);

ALTER TABLE invoice_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_invoice_verifications"
  ON invoice_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);
