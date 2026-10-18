-- REVIEW ONLY — Phase 10 follow-up for server-side equipment exclusivity.
-- Apply to Andertrack Staging only until authenticated/concurrent tests and
-- fleet safety sign-off are complete. Do not install on production from this PR.
BEGIN;
DO $guard$
BEGIN
 IF to_regprocedure('at_internal.reject_unsafe_dispatch()') IS NULL
    OR to_regclass('public.at_assignments') IS NULL
    OR to_regclass('public.at_vehicles') IS NULL
 THEN RAISE EXCEPTION 'Phase 10 safety schema must be installed first'; END IF;
END $guard$;

CREATE INDEX IF NOT EXISTS at_assignments_active_equipment_idx
 ON public.at_assignments(organization_id,vehicle_id)
 WHERE vehicle_id IS NOT NULL AND status IN
 ('offered','assigned','accepted','at_pickup','picked_up','in_transit');

-- Trigger runs AFTER the existing Phase 10 safety trigger has locked equipment.
-- It validates exclusive equipment use on the same serialized equipment row.
-- An AFTER trigger preserves the original row/update RPC semantics and rolls
-- back the transaction when another active assignment already owns the unit.
CREATE OR REPLACE FUNCTION at_internal.reject_duplicate_active_vehicle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.vehicle_id IS NULL OR NEW.status NOT IN
   ('offered','assigned','accepted','at_pickup','picked_up','in_transit')
 THEN RETURN NEW; END IF;

 IF TG_OP='UPDATE' AND OLD.vehicle_id IS NOT DISTINCT FROM NEW.vehicle_id
    AND OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.driver_user_id IS NOT DISTINCT FROM NEW.driver_user_id
 THEN RETURN NEW; END IF;

 PERFORM 1 FROM public.at_vehicles v
  WHERE v.id=NEW.vehicle_id AND v.organization_id=NEW.organization_id
  FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid fleet vehicle organization'; END IF;

 IF EXISTS (
   SELECT 1 FROM public.at_assignments a
   WHERE a.organization_id=NEW.organization_id
     AND a.vehicle_id=NEW.vehicle_id
     AND a.id<>NEW.id
     AND a.status IN
       ('offered','assigned','accepted','at_pickup','picked_up','in_transit')
 ) THEN
   RAISE EXCEPTION 'Vehicle has another active assignment; dispatch denied';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION at_internal.reject_duplicate_active_vehicle()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS at_phase10_active_vehicle_exclusivity
 ON public.at_assignments;
CREATE TRIGGER at_phase10_active_vehicle_exclusivity
 AFTER INSERT OR UPDATE OF status,vehicle_id,driver_user_id
 ON public.at_assignments FOR EACH ROW
 EXECUTE FUNCTION at_internal.reject_duplicate_active_vehicle();

COMMENT ON FUNCTION at_internal.reject_duplicate_active_vehicle() IS
 'Server-side one-active-assignment-per-vehicle safety invariant; role-gated mutation RPCs remain required.';
COMMIT;
