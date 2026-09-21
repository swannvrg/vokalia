-- Salon deletion is a real, irreversible DELETE. Dependent operational data cascades.
-- Owner accounts are deleted with their salon; invitations keep their rows and lose the link.
DO $$
DECLARE
  foreign_key record;
BEGIN
  -- Explicitly remove the owner account with its salon.
  IF to_regclass('public.app_users') IS NOT NULL THEN
    ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_business_id_fkey;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'app_users_business_id_fkey'
        AND conrelid = 'public.app_users'::regclass
    ) THEN
      ALTER TABLE public.app_users
        ADD CONSTRAINT app_users_business_id_fkey
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Invitations survive, but their deleted salon link is cleared.
  IF to_regclass('public.invitation_requests') IS NOT NULL THEN
    ALTER TABLE public.invitation_requests DROP CONSTRAINT IF EXISTS invitation_requests_business_id_fkey;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'invitation_requests_business_id_fkey'
        AND conrelid = 'public.invitation_requests'::regclass
    ) THEN
      ALTER TABLE public.invitation_requests
        ADD CONSTRAINT invitation_requests_business_id_fkey
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- All other business-owned data is deleted with the salon.
  FOR foreign_key IN
    SELECT
      c.conname,
      n.nspname AS table_schema,
      cls.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    JOIN pg_class referenced_cls ON referenced_cls.oid = c.confrelid
    JOIN pg_namespace referenced_n ON referenced_n.oid = referenced_cls.relnamespace
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, position) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key_column.attnum
    WHERE c.contype = 'f'
      AND referenced_n.nspname = 'public'
      AND referenced_cls.relname = 'businesses'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'business_id'
      AND cls.relname NOT IN ('app_users', 'invitation_requests')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', foreign_key.table_schema, foreign_key.table_name, foreign_key.conname);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE %s',
      foreign_key.table_schema,
      foreign_key.table_name,
      foreign_key.conname,
      'CASCADE'
    );
  END LOOP;
END $$;
