-- PHASE 3 REVIEW-ONLY SQL (NOT APPLIED).
-- Requires approved Phase 2 at_* tables, organization membership, and RLS.
-- Explicitly no changes to driver_location_current / driver_location_events.
-- Validate in staging and convert to a numbered Supabase migration after approval.
begin;

create schema if not exists at_private;
revoke all on schema at_private from public, anon;
grant usage on schema at_private to authenticated;

create table if not exists public.at_assignment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.at_organizations(id),
  assignment_id uuid not null references public.at_assignments(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('offer','accept','decline','arrive_pickup','pickup','start_transit')),
  previous_status text not null,
  next_status text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists at_assignment_events_org_idx
  on public.at_assignment_events(organization_id, assignment_id, occurred_at);
alter table public.at_assignment_events enable row level security;
revoke all on public.at_assignment_events from anon, authenticated;
grant select on public.at_assignment_events to authenticated;

create policy "Dispatch sees events and drivers see their assignments"
on public.at_assignment_events for select to authenticated
using (exists (
  select 1 from public.at_organization_members m
  where m.organization_id = at_assignment_events.organization_id
    and m.user_id = (select auth.uid())
    and (
      m.role in ('admin','dispatcher')
      or exists (
        select 1 from public.at_assignments a
        where a.id = at_assignment_events.assignment_id
          and a.organization_id = m.organization_id
          and a.driver_user_id = (select auth.uid())
      )
    )
));

-- Private implementation, with an independently authenticated authorization check.
-- The publicly exposed RPC wrappers use SECURITY INVOKER; the private
-- SECURITY DEFINER implementations have a fixed empty search_path.
create or replace function at_private.offer_assignment(
  p_assignment_id uuid, p_driver_user_id uuid, p_vehicle_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment public.at_assignments%rowtype;
  v_driver public.at_driver_profiles%rowtype;
  v_vehicle public.at_vehicles%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.at_assignments
    where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found'; end if;
  if not exists (
    select 1 from public.at_organization_members
    where organization_id = v_assignment.organization_id
      and user_id = v_actor and role in ('admin','dispatcher')
  ) then raise exception 'Dispatcher permission required'; end if;
  if v_assignment.status <> 'unassigned'
     or v_assignment.driver_user_id is not null then
    raise exception 'Assignment already claimed or not available';
  end if;

  select * into v_vehicle from public.at_vehicles
    where id = p_vehicle_id and organization_id = v_assignment.organization_id and enabled = true;
  if not found then raise exception 'Vehicle missing, disabled or wrong organization'; end if;
  if (v_assignment.division = 'CDL' and v_vehicle.required_license_class not in ('A','B'))
     or (v_assignment.division = 'Class C' and v_vehicle.required_license_class <> 'C') then
    raise exception 'Vehicle is not eligible for this division';
  end if;

  select * into v_driver from public.at_driver_profiles
    where organization_id = v_assignment.organization_id and user_id = p_driver_user_id for update;
  if not found or not v_driver.license_verified or v_driver.availability <> 'available' then
    raise exception 'Driver is not available or verified';
  end if;
  if not exists (
    select 1 from public.at_organization_members
    where organization_id = v_assignment.organization_id
      and user_id = p_driver_user_id and role = 'driver'
  ) then raise exception 'Driver membership required'; end if;
  if (case v_driver.license_class when 'A' then 3 when 'B' then 2 else 1 end) <
     (case v_vehicle.required_license_class when 'A' then 3 when 'B' then 2 else 1 end) then
    raise exception 'Driver license class does not meet vehicle requirement';
  end if;
  -- Pilot policy: one active offer/job per driver, prior to route batching.
  -- Locking the driver profile serializes competing offers for that driver.
  if exists (
    select 1 from public.at_assignments
    where organization_id = v_assignment.organization_id
      and driver_user_id = p_driver_user_id
      and status in ('offered','assigned','accepted','at_pickup','picked_up','in_transit')
  ) then raise exception 'Driver has another active assignment'; end if;

  update public.at_assignments
    set driver_user_id = p_driver_user_id, vehicle_id = p_vehicle_id,
        status = 'offered', updated_at = now()
    where id = p_assignment_id;

  insert into public.at_assignment_events
    (organization_id, assignment_id, actor_user_id, action, previous_status, next_status)
    values (v_assignment.organization_id, p_assignment_id, v_actor,
      'offer', 'unassigned', 'offered');
  return jsonb_build_object('id',p_assignment_id,'status','offered');
end;
$$;

create or replace function at_private.respond_assignment(
  p_assignment_id uuid, p_accept boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment public.at_assignments%rowtype;
  v_next text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.at_assignments
    where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found'; end if;
  if v_assignment.status <> 'offered' or v_assignment.driver_user_id is distinct from v_actor
     or not exists (
       select 1 from public.at_organization_members
       where organization_id = v_assignment.organization_id
         and user_id = v_actor and role = 'driver'
     ) then raise exception 'This offer is not available to your account'; end if;
  if p_accept is null then raise exception 'A response is required'; end if;

  if p_accept then
    if not exists (
      select 1 from public.at_driver_profiles d
      join public.at_vehicles v
        on v.organization_id = d.organization_id and v.id = v_assignment.vehicle_id
      where d.organization_id = v_assignment.organization_id
        and d.user_id = v_actor and d.license_verified = true
        and d.availability = 'available' and v.enabled = true
        and (case d.license_class when 'A' then 3 when 'B' then 2 else 1 end) >=
            (case v.required_license_class when 'A' then 3 when 'B' then 2 else 1 end)
    ) then raise exception 'Driver or vehicle is no longer eligible'; end if;
    v_next := 'accepted';
    update public.at_assignments set status = v_next, updated_at = now()
      where id = p_assignment_id;
  else
    v_next := 'unassigned';
    update public.at_assignments set status = v_next,
      driver_user_id = null, vehicle_id = null, updated_at = now()
      where id = p_assignment_id;
  end if;
  insert into public.at_assignment_events
    (organization_id, assignment_id, actor_user_id, action, previous_status, next_status)
    values (v_assignment.organization_id, p_assignment_id, v_actor,
      case when p_accept then 'accept' else 'decline' end,'offered',v_next);
  return jsonb_build_object('id', p_assignment_id, 'status', v_next);
end;
$$;

create or replace function at_private.advance_assignment(
  p_assignment_id uuid, p_next_status text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment public.at_assignments%rowtype;
  v_action text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.at_assignments
    where id = p_assignment_id for update;
  if not found then raise exception 'Assignment not found'; end if;
  if v_assignment.driver_user_id is distinct from v_actor
     or not exists (
       select 1 from public.at_organization_members
       where organization_id = v_assignment.organization_id
         and user_id = v_actor and role = 'driver'
     ) then raise exception 'Driver permission required'; end if;

  if v_assignment.status = 'accepted' and p_next_status = 'at_pickup' then
    v_action := 'arrive_pickup';
  elsif v_assignment.status = 'at_pickup' and p_next_status = 'picked_up' then
    v_action := 'pickup';
  elsif v_assignment.status = 'picked_up' and p_next_status = 'in_transit' then
    v_action := 'start_transit';
  else
    raise exception 'Invalid transition or proof-of-delivery workflow required';
  end if;
  update public.at_assignments set status = p_next_status, updated_at = now()
    where id = p_assignment_id;
  insert into public.at_assignment_events
    (organization_id, assignment_id, actor_user_id, action, previous_status, next_status)
    values (v_assignment.organization_id, p_assignment_id, v_actor, v_action,
      v_assignment.status, p_next_status);
  return jsonb_build_object('id',p_assignment_id,'status',p_next_status);
end;
$$;

-- The exposed public wrappers run as the caller, not as their owner.
create or replace function public.at_offer_assignment(
  p_assignment_id uuid, p_driver_user_id uuid, p_vehicle_id uuid
) returns jsonb language sql security invoker set search_path = ''
as $$select at_private.offer_assignment(p_assignment_id, p_driver_user_id, p_vehicle_id)$$;

create or replace function public.at_respond_assignment(
  p_assignment_id uuid, p_accept boolean
) returns jsonb language sql security invoker set search_path = ''
as $$select at_private.respond_assignment(p_assignment_id, p_accept)$$;

create or replace function public.at_advance_assignment(
  p_assignment_id uuid, p_next_status text
) returns jsonb language sql security invoker set search_path = ''
as $$select at_private.advance_assignment(p_assignment_id, p_next_status)$$;

-- Functions grant EXECUTE to PUBLIC by default; explicitly lock them down.
revoke all on function at_private.offer_assignment(uuid,uuid,uuid) from public, anon;
revoke all on function at_private.respond_assignment(uuid,boolean) from public, anon;
revoke all on function at_private.advance_assignment(uuid,text) from public, anon;
revoke all on function public.at_offer_assignment(uuid,uuid,uuid) from public, anon;
revoke all on function public.at_respond_assignment(uuid,boolean) from public, anon;
revoke all on function public.at_advance_assignment(uuid,text) from public, anon;

grant execute on function at_private.offer_assignment(uuid,uuid,uuid) to authenticated;
grant execute on function at_private.respond_assignment(uuid,boolean) to authenticated;
grant execute on function at_private.advance_assignment(uuid,text) to authenticated;
grant execute on function public.at_offer_assignment(uuid,uuid,uuid) to authenticated;
grant execute on function public.at_respond_assignment(uuid,boolean) to authenticated;
grant execute on function public.at_advance_assignment(uuid,text) to authenticated;

commit;
