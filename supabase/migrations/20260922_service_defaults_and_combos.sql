alter table services add column if not exists is_default boolean not null default false;
alter table services add column if not exists combo_service_id uuid references services(id) on delete set null;

create unique index if not exists services_one_default_per_business
  on services (business_id) where is_default and active;
