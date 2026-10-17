-- Andertrack Phase 5: server-authoritative, tenant-scoped FIFO dispatch.
-- Staging verified before production approval. No changes to existing load / GPS tables.
CREATE TABLE public.at_dispatch_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 queue_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 organization_id uuid NOT NULL REFERENCES public.at_organizations(id) ON DELETE CASCADE,
 driver_user_id uuid NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','assigned','cancelled')),
 assignment_id uuid,
 handled_by uuid REFERENCES auth.users(id),
 handled_at timestamptz,
 CONSTRAINT at_dispatch_driver_fk FOREIGN KEY (organization_id,driver_user_id)
  REFERENCES public.at_driver_profiles(organization_id,user_id),
 CONSTRAINT at_dispatch_assignment_fk FOREIGN KEY (organization_id,assignment_id)
  REFERENCES public.at_assignments(organization_id,id),
 CONSTRAINT at_dispatch_outcome CHECK(
   (status='queued' AND assignment_id IS NULL AND handled_by IS NULL AND handled_at IS NULL)
   OR (status='assigned' AND assignment_id IS NOT NULL AND handled_by IS NOT NULL AND handled_at IS NOT NULL)
   OR (status='cancelled' AND assignment_id IS NULL AND handled_by=driver_user_id AND handled_at IS NOT NULL)
 )
);
CREATE UNIQUE INDEX at_dispatch_one_active_driver
 ON public.at_dispatch_requests(organization_id,driver_user_id) WHERE status='queued';
CREATE INDEX at_dispatch_fifo_idx
 ON public.at_dispatch_requests(organization_id,queue_number) WHERE status='queued';
CREATE INDEX at_dispatch_driver_history_idx
 ON public.at_dispatch_requests(driver_user_id,organization_id,requested_at DESC);
ALTER TABLE public.at_dispatch_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.at_dispatch_requests FROM anon,authenticated;
GRANT SELECT ON public.at_dispatch_requests TO authenticated;
CREATE POLICY "Dispatchers see org queue and drivers see self"
 ON public.at_dispatch_requests FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM public.at_organization_members m
  WHERE m.organization_id=at_dispatch_requests.organization_id
   AND m.user_id=(SELECT auth.uid())
   AND (m.role IN ('admin','dispatcher') OR at_dispatch_requests.driver_user_id=(SELECT auth.uid()))
 ));

-- Requests and claims serialize on a per-organization advisory lock.
-- The sequence is allocated inside the lock; order is independent of client timestamps.
CREATE FUNCTION at_private.request_dispatch(p_organization_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
 AS $$
 DECLARE v_actor uuid:=auth.uid(); v_request public.at_dispatch_requests%ROWTYPE;
 BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_organization_id IS NULL THEN RAISE EXCEPTION 'Organization is required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,923841));
  IF NOT EXISTS (
    SELECT 1 FROM public.at_organization_members
    WHERE organization_id=p_organization_id AND user_id=v_actor AND role='driver'
  ) THEN RAISE EXCEPTION 'Driver membership required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.at_driver_profiles
    WHERE organization_id=p_organization_id AND user_id=v_actor
     AND license_verified=true AND availability='available'
  ) THEN RAISE EXCEPTION 'Verified, available driver required'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.at_assignments
    WHERE organization_id=p_organization_id AND driver_user_id=v_actor
    AND status IN ('offered','assigned','accepted','at_pickup','picked_up','in_transit')
  ) THEN RAISE EXCEPTION 'Active assignment must finish before requesting'; END IF;
  SELECT * INTO v_request FROM public.at_dispatch_requests
   WHERE organization_id=p_organization_id AND driver_user_id=v_actor
    AND status='queued' LIMIT 1;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('id',v_request.id,'status','queued','queue_number',v_request.queue_number,'existing',true);
  END IF;
  INSERT INTO public.at_dispatch_requests(organization_id,driver_user_id)
   VALUES (p_organization_id,v_actor) RETURNING * INTO v_request;
  RETURN pg_catalog.jsonb_build_object('id',v_request.id,'status','queued','queue_number',v_request.queue_number,'existing',false);
 END $$;

CREATE FUNCTION at_private.cancel_dispatch(p_organization_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
 AS $$
 DECLARE v_actor uuid:=auth.uid(); v_row public.at_dispatch_requests%ROWTYPE;
 BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_organization_id IS NULL THEN RAISE EXCEPTION 'Organization is required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,923841));
  IF NOT EXISTS (
    SELECT 1 FROM public.at_organization_members WHERE organization_id=p_organization_id
     AND user_id=v_actor AND role='driver'
  ) THEN RAISE EXCEPTION 'Driver membership required'; END IF;
  UPDATE public.at_dispatch_requests SET status='cancelled',handled_by=v_actor,handled_at=clock_timestamp()
   WHERE organization_id=p_organization_id AND driver_user_id=v_actor AND status='queued'
   RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending request to cancel'; END IF;
  RETURN pg_catalog.jsonb_build_object('id',v_row.id,'status',v_row.status);
 END $$;

CREATE FUNCTION at_private.claim_next_dispatch(
 p_organization_id uuid, p_assignment_id uuid, p_vehicle_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_request public.at_dispatch_requests%ROWTYPE;
 v_result jsonb;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_organization_id IS NULL OR p_assignment_id IS NULL OR p_vehicle_id IS NULL
 THEN RAISE EXCEPTION 'Organization, assignment and vehicle are required'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.at_organization_members WHERE organization_id=p_organization_id
  AND user_id=v_actor AND role IN ('admin','dispatcher')
 ) THEN RAISE EXCEPTION 'Dispatcher permission required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text,923841));
 SELECT * INTO v_request FROM public.at_dispatch_requests
  WHERE organization_id=p_organization_id AND status='queued'
  ORDER BY queue_number ASC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No waiting requests'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.at_assignments a WHERE a.id=p_assignment_id
   AND a.organization_id=p_organization_id AND a.status='unassigned' AND a.driver_user_id IS NULL
 ) THEN RAISE EXCEPTION 'Assignment unavailable or belongs to another organization'; END IF;
 -- The existing RPC rechecks org, verified driver, vehicle, qualifications and active load.
 -- A failed offer rolls back the queue claim and retains the head request.
 v_result:=at_private.offer_assignment(p_assignment_id,v_request.driver_user_id,p_vehicle_id);
 UPDATE public.at_dispatch_requests
  SET status='assigned',assignment_id=p_assignment_id,handled_by=v_actor,handled_at=clock_timestamp()
  WHERE id=v_request.id;
 RETURN pg_catalog.jsonb_build_object('request_id',v_request.id,'queue_number',v_request.queue_number,
   'driver_user_id',v_request.driver_user_id,'assignment_id',p_assignment_id,'offer',v_result);
END $$;

CREATE FUNCTION public.at_request_dispatch(p_organization_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT at_private.request_dispatch(p_organization_id) $$;
CREATE FUNCTION public.at_cancel_dispatch(p_organization_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT at_private.cancel_dispatch(p_organization_id) $$;
CREATE FUNCTION public.at_claim_next_dispatch(p_organization_id uuid,p_assignment_id uuid,p_vehicle_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT at_private.claim_next_dispatch(p_organization_id,p_assignment_id,p_vehicle_id) $$;

REVOKE ALL ON FUNCTION at_private.request_dispatch(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION at_private.cancel_dispatch(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION at_private.claim_next_dispatch(uuid,uuid,uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.at_request_dispatch(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.at_cancel_dispatch(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.at_claim_next_dispatch(uuid,uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION at_private.request_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION at_private.cancel_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION at_private.claim_next_dispatch(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.at_request_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.at_cancel_dispatch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.at_claim_next_dispatch(uuid,uuid,uuid) TO authenticated;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='at_dispatch_requests')
 THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.at_dispatch_requests;
 END IF;
END $$;
