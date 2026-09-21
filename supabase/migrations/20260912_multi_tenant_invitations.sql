-- Multi-tenant ownership and invitation workflow. All changes are additive.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_status_check') THEN
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_status_check CHECK (status IN ('active', 'pending'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'owner'))
);

CREATE TABLE IF NOT EXISTS public.invitation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  business_id uuid REFERENCES public.businesses(id),
  CONSTRAINT invitation_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- The current test account is the first auth account in the existing project.
-- It remains an owner; the administrator must be assigned separately.
DO $$
DECLARE first_user uuid;
BEGIN
  SELECT id INTO first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, role) VALUES (first_user, 'owner')
      ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
    UPDATE public.businesses SET owner_user_id = first_user
      WHERE owner_user_id IS NULL
        AND id = '11111111-1111-1111-1111-111111111111'::uuid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'); $$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Defense in depth. Server routes still apply explicit tenant filters.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND policyname = 'businesses_owner_read') THEN
    CREATE POLICY businesses_owner_read ON public.businesses FOR SELECT USING (owner_user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'businesses' AND policyname = 'businesses_owner_write') THEN
    CREATE POLICY businesses_owner_write ON public.businesses FOR UPDATE USING (owner_user_id = auth.uid() OR public.is_admin()) WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_self_read') THEN
    CREATE POLICY profiles_self_read ON public.profiles FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invitation_requests' AND policyname = 'invitation_requests_admin_all') THEN
    CREATE POLICY invitation_requests_admin_all ON public.invitation_requests FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resources' AND policyname = 'resources_owner_access') THEN
    CREATE POLICY resources_owner_access ON public.resources FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = resources.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = resources.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'services_owner_access') THEN
    CREATE POLICY services_owner_access ON public.services FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = services.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = services.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_hours' AND policyname = 'business_hours_owner_access') THEN
    CREATE POLICY business_hours_owner_access ON public.business_hours FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_hours.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_hours.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments' AND policyname = 'appointments_owner_access') THEN
    CREATE POLICY appointments_owner_access ON public.appointments FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = appointments.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = appointments.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers_owner_access') THEN
    CREATE POLICY customers_owner_access ON public.customers FOR ALL USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND (b.owner_user_id = auth.uid() OR public.is_admin())));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS businesses_owner_user_id_idx ON public.businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS invitation_requests_status_idx ON public.invitation_requests(status, created_at);