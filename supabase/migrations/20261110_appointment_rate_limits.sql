ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS request_ip text;

CREATE INDEX IF NOT EXISTS appointments_request_ip_created_at_idx
  ON public.appointments(request_ip, created_at);

CREATE INDEX IF NOT EXISTS appointments_business_customer_start_time_idx
  ON public.appointments(business_id, customer_id, start_time);
