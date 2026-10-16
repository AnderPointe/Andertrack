-- STAGING ONLY. DO NOT apply to production: it already has the real GPS tables.
-- Empty structure for testing GPS RLS. No production GPS rows are copied.
create type public.driver_live_status as enum ('available','assigned','loaded','break','offline','alert');
create table public.driver_location_current (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null, driver_id uuid not null unique,
 latitude double precision not null, longitude double precision not null,
 heading integer default 0, speed_mph numeric default 0, accuracy_meters numeric,
 status public.driver_live_status not null default 'available',
 current_load_id uuid, current_load_number text, vehicle_id uuid, vehicle_type text,
 unit_number text, eta_minutes integer, battery_percent integer, signal_strength integer,
 last_ping_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.driver_location_current enable row level security;
revoke all on public.driver_location_current from anon,authenticated;
