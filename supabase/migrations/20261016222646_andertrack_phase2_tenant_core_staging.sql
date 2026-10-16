-- Applied and verified on separate Andertrack Staging project only.
-- Do not deploy to production without explicit user approval.
-- Andertrack Phase 2: REVIEW ONLY, not applied to a database.
-- Baseline schema for org-scoped, read-only operational dashboards.
-- The existing driver_location_current and driver_location_events tables are untouched.
-- Before deployment: review in staging, generate a migration using the Supabase CLI,
-- run security advisors, then apply with an approved deployment workflow.
create table if not exists public.at_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  created_at timestamptz not null default now()
);

create table if not exists public.at_organization_members (
  organization_id uuid not null references public.at_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','dispatcher','driver')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists at_members_user_idx on public.at_organization_members(user_id);

create table if not exists public.at_driver_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.at_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  license_class text not null check (license_class in ('A','B','C')),
  license_verified boolean not null default false,
  availability text not null default 'offline' check (availability in ('available','busy','break','offline')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.at_vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.at_organizations(id) on delete cascade,
  unit_number text not null,
  vehicle_type text not null check (vehicle_type in ('car','cargo_van','box_truck','hotshot','tractor','other')),
  required_license_class text not null check (required_license_class in ('A','B','C')),
  payload_capacity_lbs integer check (payload_capacity_lbs >= 0),
  enabled boolean not null default true,
  unique (organization_id, id),
  unique (organization_id, unit_number)
);

create table if not exists public.at_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.at_organizations(id) on delete cascade,
  reference text not null,
  division text not null check (division in ('CDL','Class C')),
  customer_name text not null,
  commodity text not null,
  pickup_address text not null,
  dropoff_address text not null,
  estimated_miles numeric(12,2) check (estimated_miles >= 0),
  vehicle_id uuid,
  driver_user_id uuid,
  status text not null default 'unassigned'
    check (status in ('unassigned','offered','assigned','accepted','at_pickup','picked_up','in_transit','delivered','cancelled')),
  scheduled_pickup_at timestamptz,
  scheduled_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  foreign key (organization_id, vehicle_id)
    references public.at_vehicles(organization_id, id),
  foreign key (organization_id, driver_user_id)
    references public.at_driver_profiles(organization_id, user_id),
  constraint at_assignment_driver_status_consistency check (
    (status = 'unassigned' and driver_user_id is null)
    or (status <> 'unassigned')
  )
);
create index if not exists at_assignments_org_status_idx on public.at_assignments(organization_id, status);
create index if not exists at_assignments_driver_idx on public.at_assignments(driver_user_id, organization_id);

-- Deny anonymous access, and grant authenticated clients SELECT ONLY.
-- All inserts and assignment changes must come from a separately validated,
-- authorized server workflow; the frontend intentionally has no write path.
alter table public.at_organizations enable row level security;
alter table public.at_organization_members enable row level security;
alter table public.at_driver_profiles enable row level security;
alter table public.at_vehicles enable row level security;
alter table public.at_assignments enable row level security;

revoke all on public.at_organizations, public.at_organization_members,
  public.at_driver_profiles, public.at_vehicles, public.at_assignments
  from anon, authenticated;
grant select on public.at_organizations, public.at_organization_members,
  public.at_driver_profiles, public.at_vehicles, public.at_assignments
  to authenticated;

create policy "Members view own membership"
  on public.at_organization_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members view organization"
  on public.at_organizations for select to authenticated
  using (exists (
    select 1 from public.at_organization_members m
    where m.organization_id = id and m.user_id = (select auth.uid())
  ));

create policy "Dispatch views org driver roster; drivers only see self"
  on public.at_driver_profiles for select to authenticated
  using (exists (
    select 1 from public.at_organization_members m
    where m.organization_id = at_driver_profiles.organization_id
      and m.user_id = (select auth.uid())
      and (m.role in ('admin','dispatcher')
           or at_driver_profiles.user_id = (select auth.uid()))
  ));

create policy "Members view vehicles in own organization"
  on public.at_vehicles for select to authenticated
  using (exists (
    select 1 from public.at_organization_members m
    where m.organization_id = at_vehicles.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy "Dispatchers view org and drivers view assigned work"
  on public.at_assignments for select to authenticated
  using (exists (
    select 1 from public.at_organization_members m
    where m.organization_id = at_assignments.organization_id
      and m.user_id = (select auth.uid())
      and (
        m.role in ('admin','dispatcher')
        or (m.role = 'driver' and at_assignments.driver_user_id = (select auth.uid()))
      )
  ));

-- Realtime subscription will only deliver rows readable under RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'at_assignments'
     ) then
    alter publication supabase_realtime add table public.at_assignments;
  end if;
end $$;