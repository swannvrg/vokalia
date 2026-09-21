-- RLS policies for app_users, app_sessions, app_invitation_tokens.
-- The service_role key bypasses RLS automatically in Supabase, but explicit
-- policies are added here as defense-in-depth and to allow future Postgres-level
-- operations if needed.
--
-- No anon or authenticated policies are needed: all routes use the service_role
-- client from the server (lib/supabase.ts → createSupabaseAdminClient).

DO $$
BEGIN
  -- app_users: only the service role can read/write (no auth.uid() policy needed)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_users' AND policyname = 'app_users_service_all'
  ) THEN
    CREATE POLICY app_users_service_all ON public.app_users
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- app_sessions: same — service_role only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_sessions' AND policyname = 'app_sessions_service_all'
  ) THEN
    CREATE POLICY app_sessions_service_all ON public.app_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- app_invitation_tokens: same — service_role only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_invitation_tokens' AND policyname = 'app_invitation_tokens_service_all'
  ) THEN
    CREATE POLICY app_invitation_tokens_service_all ON public.app_invitation_tokens
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
