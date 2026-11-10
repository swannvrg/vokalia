ALTER TABLE public.invitation_requests
  ADD COLUMN IF NOT EXISTS request_ip text;

CREATE INDEX IF NOT EXISTS invitation_requests_request_ip_created_at_idx
  ON public.invitation_requests(request_ip, created_at);

CREATE INDEX IF NOT EXISTS invitation_requests_email_created_at_idx
  ON public.invitation_requests(email, created_at);

CREATE INDEX IF NOT EXISTS invitation_requests_phone_created_at_idx
  ON public.invitation_requests(phone, created_at);
