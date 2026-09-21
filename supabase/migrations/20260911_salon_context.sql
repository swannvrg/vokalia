CREATE OR REPLACE FUNCTION public.get_salon_context(p_business_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'business_hours', (
      SELECT jsonb_agg(jsonb_build_object(
        'day_of_week', d.day_of_week,
        'day_name', (ARRAY['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'])[d.day_of_week + 1],
        'is_open', bh.open_time IS NOT NULL,
        'open_time', bh.open_time,
        'close_time', bh.close_time
      ) ORDER BY d.day_of_week)
      FROM generate_series(0,6) AS d(day_of_week)
      LEFT JOIN business_hours bh
        ON bh.business_id = p_business_id AND bh.day_of_week = d.day_of_week
    ),
    'services', (
      SELECT jsonb_agg(jsonb_build_object(
        'service_id', id,
        'name', name,
        'duration_minutes', duration_minutes
      ) ORDER BY name)
      FROM services
      WHERE business_id = p_business_id AND active = true
    ),
    'resources', (
      SELECT jsonb_agg(jsonb_build_object(
        'resource_id', id,
        'name', name
      ) ORDER BY name)
      FROM resources
      WHERE business_id = p_business_id AND active = true
    )
  );
$function$;