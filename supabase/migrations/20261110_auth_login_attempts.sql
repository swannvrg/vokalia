-- Échecs de connexion, pour limiter la force brute sur /api/auth/login.
-- Écrite et lue uniquement par le serveur (clé service_role) : aucun accès pour anon ni authenticated.
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  request_ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_login_attempts_email_created_at_idx
  ON public.auth_login_attempts (email, created_at);

CREATE INDEX IF NOT EXISTS auth_login_attempts_ip_created_at_idx
  ON public.auth_login_attempts (request_ip, created_at);

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_login_attempts FROM anon, authenticated, public;
