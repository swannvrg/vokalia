-- Migration for atomic default service update
create or replace function set_default_service(p_business_id uuid, p_service_id uuid)
returns void as $$
begin
  -- Unset default flag for all services of this business
  update services
  set is_default = false
  where business_id = p_business_id and is_default = true;

  -- Set target service as default and ensure combo_service_id is null
  update services
  set is_default = true, combo_service_id = null
  where id = p_service_id and business_id = p_business_id and active = true;
end;
$$ language plpgsql security definer;
