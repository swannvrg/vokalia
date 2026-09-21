ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#D96D4B';

COMMENT ON COLUMN public.resources.color IS
  'Hex color used to identify this practitioner in the back-office calendar.';
