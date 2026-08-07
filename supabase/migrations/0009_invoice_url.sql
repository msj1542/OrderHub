-- Add invoice URL column to invoice_verifications
ALTER TABLE public.invoice_verifications
  ADD COLUMN IF NOT EXISTS invoice_url TEXT;
