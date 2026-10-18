-- Phase 10 REVIEW ONLY: never apply to production without safety sign-off.
-- Prerequisite: Phase 9 DVIR schema installed and validated in target environment.
-- This protects at_offer_assignment, at_claim_next_dispatch and acceptance
-- via one table-level trigger; it is not FMCSA certification or clearance.
BEGIN;

DO $guard$
BEGIN
 IF to_regclass('public.at_vehicle_dvir_reports') IS NULL OR
    to_regclass('public.at_assignments') IS NULL OR
    to_regclass('public.at_vehicles') IS NULL
 THEN
   RAISE EXCEPTION 'Phase 10 requires existing Phase 9 safety and dispatch tables';
 END IF;
END $guard$;

-- Keep the lock-path check efficient as DVIR records accumulate.
CREATE INDEX IF NOT EXISTS at_dvir_open_oos_dispatch_idx
 ON public.at_vehicle_dvir_reports(organization_id,vehicle_id)
 WHERE severity='out-of-service' AND status<>'closed';

-- Private function schema is not exposed as a Supabase Data API endpoint.
CREATE SCHEMA IF NOT EXISTS at_internal;
REVOKE ALL ON SCHEMA at_internal FROM PUBLIC,anon,authenticated;

-- Locks the equipment row before a severe defect becomes visible.
-- Dispatch checks lock that same row; offer/accept and OOS submission cannot
-- pass each other without a serialized safety check.
CREATE OR REPLACE FUNCTION at_internal.serialize_severe_dvir_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.severity='out-of-service' THEN
   PERFORM 1 FROM public.at_vehicles v
    WHERE v.id=NEW.vehicle_id AND v.organization_id=NEW.organization_id
    FOR UPDATE;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Vehicle does not belong to defect organization';
   END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION at_internal.serialize_severe_dvir_insert()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS at_phase10_serialize_severe_dvir
 ON public.at_vehicle_dvir_reports;
CREATE TRIGGER at_phase10_serialize_severe_dvir
 BEFORE INSERT OR UPDATE OF severity,status,vehicle_id,organization_id
 ON public.at_vehicle_dvir_reports
 FOR EACH ROW EXECUTE FUNCTION at_internal.serialize_severe_dvir_insert();

-- Enforce on NEW offers, offers created from queued claims, acceptance,
-- and every forward active-status transition, plus equipment/driver reassignment.
-- Existing in-progress loads reported unsafe AFTER acceptance require an
-- immediate operational hold/escalation; this does not silently cancel loads.
CREATE OR REPLACE FUNCTION at_internal.reject_unsafe_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE must_check boolean := false;
BEGIN
 IF TG_OP='INSERT' THEN
   must_check := NEW.vehicle_id IS NOT NULL AND NEW.status IN
     ('offered','assigned','accepted','at_pickup','picked_up','in_transit');
 ELSE
   must_check := NEW.vehicle_id IS NOT NULL AND (
     (NEW.status IN ('offered','assigned','accepted','at_pickup','picked_up','in_transit') AND
       (NEW.status IS DISTINCT FROM OLD.status OR
        NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
        NEW.driver_user_id IS DISTINCT FROM OLD.driver_user_id))
     OR (NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id AND NEW.status IN
       ('at_pickup','picked_up','in_transit'))
   );
 END IF;
 IF NOT must_check THEN RETURN NEW; END IF;

 PERFORM 1 FROM public.at_vehicles v
  WHERE v.id=NEW.vehicle_id AND v.organization_id=NEW.organization_id
  FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid dispatch vehicle or organization'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.at_vehicle_dvir_reports d
   WHERE d.organization_id=NEW.organization_id AND d.vehicle_id=NEW.vehicle_id
     AND d.severity='out-of-service' AND d.status<>'closed'
 ) THEN
   RAISE EXCEPTION 'Vehicle has an open out-of-service DVIR safety hold; dispatch denied';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION at_internal.reject_unsafe_dispatch()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS at_phase10_dispatch_safety
 ON public.at_assignments;
CREATE TRIGGER at_phase10_dispatch_safety
 BEFORE INSERT OR UPDATE OF status,vehicle_id,driver_user_id
 ON public.at_assignments FOR EACH ROW
 EXECUTE FUNCTION at_internal.reject_unsafe_dispatch();

-- Read-only, organization-scoped planner snapshot for EXPLAINABLE UI
-- recommendations. Does NOT authorize offers; trigger always rechecks.
-- Invoker mode honors RLS for the caller on existing Phase 9 tables.
CREATE OR REPLACE FUNCTION public.at_dispatch_vehicle_safety_status(
  p_organization_id uuid
) RETURNS TABLE(vehicle_id uuid,open_out_of_service bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.at_organization_members m
   WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid()
     AND m.role IN ('admin','dispatcher')
 ) THEN RAISE EXCEPTION 'Planner organization membership required'; END IF;

 RETURN QUERY
 SELECT v.id,COUNT(d.id) FILTER (WHERE d.id IS NOT NULL)
 FROM public.at_vehicles v
 LEFT JOIN public.at_vehicle_dvir_reports d
   ON d.vehicle_id=v.id AND d.organization_id=v.organization_id
      AND d.severity='out-of-service' AND d.status<>'closed'
 WHERE v.organization_id=p_organization_id
 GROUP BY v.id;
END $fn$;
REVOKE ALL ON FUNCTION public.at_dispatch_vehicle_safety_status(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.at_dispatch_vehicle_safety_status(uuid)
 TO authenticated;

COMMENT ON FUNCTION public.at_dispatch_vehicle_safety_status(uuid) IS
 'RLS-scoped planning evidence only, not safety release or vehicle dispatch authorization.';
COMMIT;
