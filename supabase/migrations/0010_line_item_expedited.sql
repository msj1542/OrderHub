ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS is_expedited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS requested_date TEXT;
