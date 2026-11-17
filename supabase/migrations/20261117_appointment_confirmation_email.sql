CREATE TABLE IF NOT EXISTS public.appointment_email_deliveries (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing',
  started_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  last_error text,
  CONSTRAINT appointment_email_deliveries_status_check
    CHECK (status IN ('processing', 'failed', 'sent'))
);

ALTER TABLE public.appointment_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_appointment_email_delivery(
  p_appointment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_claimed boolean;
BEGIN
  IF p_appointment_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.appointment_email_deliveries (
    appointment_id,
    status,
    started_at,
    attempt_count,
    last_error
  )
  VALUES (
    p_appointment_id,
    'processing',
    now(),
    1,
    NULL
  )
  ON CONFLICT (appointment_id) DO UPDATE
  SET
    status = 'processing',
    started_at = now(),
    updated_at = now(),
    attempt_count = public.appointment_email_deliveries.attempt_count + 1,
    last_error = NULL
  WHERE public.appointment_email_deliveries.status = 'failed'
     OR (
       public.appointment_email_deliveries.status = 'processing'
       AND public.appointment_email_deliveries.started_at < now() - interval '10 minutes'
     )
  RETURNING true INTO v_claimed;

  RETURN COALESCE(v_claimed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_appointment_email_delivery(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_appointment_email_delivery(uuid)
  TO service_role;

REVOKE ALL ON TABLE public.appointment_email_deliveries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointment_email_deliveries
  TO service_role;

CREATE OR REPLACE FUNCTION public.notify_appointment_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'callback_webhook_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'appointment_confirmation: CALLBACK webhook secret not found in vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://www.vokalia.fr/api/booking-confirm-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'appointments',
      'schema', 'public',
      'record', to_jsonb(NEW)
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_appointment_confirmation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_appointment_confirmation()
  TO service_role;

DROP TRIGGER IF EXISTS notify_appointment_confirmation ON public.appointments;

CREATE TRIGGER notify_appointment_confirmation
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_confirmation();
