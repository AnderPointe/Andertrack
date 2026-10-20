-- REVIEW ONLY. Apply in staging first; no existing vehicle or driver GPS rows changed.
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
-- This script expects PostGIS in extensions; adapt qualified types if installed elsewhere.
create table public.at_vehicle_telemetry (
  organization_id uuid not null,
  vehicle_id uuid not null,
  truck_id text not null,
  current_speed_kmh double precision not null check (current_speed_kmh between 0 and 300),
  fuel_level_pct double precision not null check (fuel_level_pct between 0 and 100),
  odometer_km double precision not null check (odometer_km between 0 and 1e9),
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  altitude_m double precision not null check (altitude_m between -12000 and 100000),
  position extensions.geometry(PointZ,4326) not null,
  updated_at timestamptz not null,
  primary key (organization_id, vehicle_id),
  foreign key (organization_id, vehicle_id) references public.at_vehicles(organization_id,id)
);
alter table public.at_vehicle_telemetry enable row level security;
revoke all on public.at_vehicle_telemetry from anon, authenticated;
grant select on public.at_vehicle_telemetry to authenticated;
grant all on public.at_vehicle_telemetry to service_role;
create policy "Planners read own fleet telemetry" on public.at_vehicle_telemetry
for select to authenticated using (exists (
  select 1 from public.at_organization_members m
  where m.organization_id = at_vehicle_telemetry.organization_id
  and m.user_id = (select auth.uid()) and m.role in ('admin','dispatcher')
));
create policy "Planners receive private fleet telemetry" on realtime.messages
for select to authenticated using (extension = 'broadcast' and exists (
  select 1 from public.at_organization_members m
  where m.user_id = (select auth.uid()) and m.role in ('admin','dispatcher')
  and (select realtime.topic()) = 'telemetry:' || m.organization_id::text
));
-- Invoker rights + service_role-only execution. Tenant is a trusted collector
-- setting, not a device-supplied field. Unknown units abort rather than create inventory.
create function public.at_ingest_vehicle_telemetry(p_organization_id uuid, p_ticks jsonb)
returns void language plpgsql security invoker set search_path = public, extensions, pg_temp as $$
begin
  if jsonb_typeof(p_ticks) <> 'array' or jsonb_array_length(p_ticks) not between 1 and 50 then
    raise exception 'Expected 1..50 ticks';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_ticks) t
    where not exists (select 1 from public.at_vehicles v
      where v.organization_id = p_organization_id and v.unit_number = t->>'truck_id' and v.enabled)
  ) then raise exception 'Unknown or disabled truck'; end if;
  insert into public.at_vehicle_telemetry as stored (
    organization_id, vehicle_id, truck_id, current_speed_kmh, fuel_level_pct,
    odometer_km, longitude, latitude, altitude_m, position, updated_at
  ) select p_organization_id, v.id, t.truck_id, t.current_speed_kmh, t.fuel_level_pct,
    t.odometer_km, t.longitude, t.latitude, t.altitude_m,
    extensions.st_setsrid(extensions.st_makepoint(t.longitude,t.latitude,t.altitude_m),4326), t.updated_at
  from (select distinct on (truck_id) * from jsonb_to_recordset(p_ticks) as records(truck_id text, current_speed_kmh double precision,
    fuel_level_pct double precision, odometer_km double precision, longitude double precision,
    latitude double precision, altitude_m double precision, updated_at timestamptz)
    order by truck_id, updated_at desc) t
  join public.at_vehicles v on v.organization_id = p_organization_id and v.unit_number = t.truck_id
  on conflict (organization_id, vehicle_id) do update set
    current_speed_kmh = excluded.current_speed_kmh, fuel_level_pct = excluded.fuel_level_pct,
    odometer_km = excluded.odometer_km, longitude = excluded.longitude, latitude = excluded.latitude,
    altitude_m = excluded.altitude_m, position = excluded.position, updated_at = excluded.updated_at
  where excluded.updated_at > stored.updated_at;
end;
$$;
revoke all on function public.at_ingest_vehicle_telemetry(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.at_ingest_vehicle_telemetry(uuid,jsonb) to service_role;
commit;
