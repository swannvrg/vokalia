DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.businesses
    WHERE phone_number IS NOT NULL
    GROUP BY phone_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create businesses_phone_number_unique_idx: duplicate non-null phone_number values exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_phone_number_unique_idx
  ON public.businesses (phone_number)
  WHERE phone_number IS NOT NULL;
