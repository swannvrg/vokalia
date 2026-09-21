-- Application authentication. Supabase remains the database, but auth.users is no longer used.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS app_user_id uuid;

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  role text NOT NULL DEFAULT 'owner',
  business_id uuid REFERENCES public.businesses(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_role_check CHECK (role IN ('admin', 'owner'))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_idx ON public.app_users (lower(email));

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_invitation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS app_invitation_tokens_user_id_idx ON public.app_invitation_tokens(user_id);

-- The password is stored only as a scrypt hash. Change it after first login.
INSERT INTO public.app_users (email, password_hash, role)
VALUES (
  'swannvrg@gmail.com',
  'scrypt$3e461df5d6122cbd03a255377b13f5c0$5213d4ac637f3ac90a061cdcde924996bd33bcebb4f6fa41f384df5ca6e94ce3713a2f546b4439836db0d66079c958a5449d78d0e7ef7fb0679b7696236f89b2',
  'admin'
)
ON CONFLICT (lower(email)) DO UPDATE SET role = 'admin', active = true;

-- Defense-in-depth only. Server routes authenticate through app_sessions.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_invitation_tokens ENABLE ROW LEVEL SECURITY;
