ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price numeric(10, 2);

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_price_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_price_check CHECK (price IS NULL OR price >= 0);