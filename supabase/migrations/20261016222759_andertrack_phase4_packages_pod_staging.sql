-- Applied and verified on separate Andertrack Staging project only.
-- Do not deploy to production without explicit user approval.
-- Andertrack Phase 4: REVIEW-ONLY SQL. DO NOT EXECUTE BEFORE PHASES 2 AND 3.
-- This is not an applied migration. Test against staging and inspect storage/RLS behavior.
-- Requires at_organizations, at_organization_members, at_assignments, at_assignment_events,
-- at_driver_profiles and the prior at_private schema.
-- Existing driver_location_events remains untouched.
-- Enforce a composite tenant-consistent FK from packages and POD to assignments.
ALTER TABLE public.at_assignments
  ADD CONSTRAINT at_assignments_org_id_unique UNIQUE (organization_id, id);

CREATE TABLE public.at_assignment_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  tracking_code text NOT NULL CHECK (length(trim(tracking_code)) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','picked_up','delivered')),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_packages_assignment_fkey FOREIGN KEY (organization_id,assignment_id)
    REFERENCES public.at_assignments (organization_id,id),
  UNIQUE (assignment_id,tracking_code)
);
CREATE INDEX at_packages_org_assignment_idx
  ON public.at_assignment_packages(organization_id,assignment_id);

CREATE TABLE public.at_package_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.at_organizations(id),
  assignment_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES public.at_assignment_packages(id),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('pickup','delivery')),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_pkg_events_assignment_fkey FOREIGN KEY (organization_id,assignment_id)
    REFERENCES public.at_assignments (organization_id,id)
);
CREATE INDEX at_package_events_assignment_idx
  ON public.at_package_events(organization_id,assignment_id,scanned_at);

CREATE TABLE public.at_delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  assignment_id uuid NOT NULL UNIQUE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_name text NOT NULL CHECK (length(trim(recipient_name)) BETWEEN 2 AND 120),
  evidence_path text NOT NULL UNIQUE,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_delivery_proofs_assignment_fkey FOREIGN KEY (organization_id,assignment_id)
    REFERENCES public.at_assignments (organization_id,id)
);

-- Table access is read-only for ordinary authenticated clients.
ALTER TABLE public.at_assignment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.at_package_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.at_delivery_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.at_assignment_packages,public.at_package_events,
  public.at_delivery_proofs FROM anon,authenticated;
GRANT SELECT ON public.at_assignment_packages,public.at_package_events,
  public.at_delivery_proofs TO authenticated;

CREATE POLICY "Scoped packages for dispatch and assigned drivers"
  ON public.at_assignment_packages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.at_organization_members m
    JOIN public.at_assignments a ON a.organization_id = m.organization_id
      AND a.id = at_assignment_packages.assignment_id
    WHERE m.organization_id = at_assignment_packages.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND (m.role IN ('admin','dispatcher')
        OR (m.role='driver' AND a.driver_user_id = (SELECT auth.uid())))
  ));

CREATE POLICY "Scoped package scan history"
  ON public.at_package_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.at_organization_members m
    JOIN public.at_assignments a ON a.organization_id = m.organization_id
      AND a.id = at_package_events.assignment_id
    WHERE m.organization_id = at_package_events.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND (m.role IN ('admin','dispatcher')
        OR (m.role='driver' AND a.driver_user_id = (SELECT auth.uid())))
  ));

CREATE POLICY "Scoped private delivery proof metadata"
  ON public.at_delivery_proofs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.at_organization_members m
    WHERE m.organization_id = at_delivery_proofs.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND (m.role IN ('admin','dispatcher')
        OR (m.role='driver' AND at_delivery_proofs.driver_user_id = (SELECT auth.uid())))
  ));

-- Phase 3 assignment-event action set must include completed delivery.
ALTER TABLE public.at_assignment_events
  DROP CONSTRAINT IF EXISTS at_assignment_events_action_check;
ALTER TABLE public.at_assignment_events
  ADD CONSTRAINT at_assignment_events_action_check
  CHECK (action IN ('offer','accept','decline','arrive_pickup',
    'pickup','start_transit','deliver'));

-- A private Storage bucket is required. Never create a public evidence bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('at-delivery-evidence','at-delivery-evidence',false,10485760,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets
             WHERE id='at-delivery-evidence' AND public=true) THEN
    RAISE EXCEPTION 'Delivery evidence bucket must be private';
  END IF;
END $$;

-- Upload path: org_uuid/assignment_uuid/driver_auth_uuid/random_uuid.(jpg|png|webp)
-- Only the driver assigned to an IN TRANSIT load may upload.
CREATE POLICY "Assigned driver creates evidence object"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='at-delivery-evidence'
  AND (storage.foldername(name))[3] = (SELECT auth.uid())::text
  AND (storage.foldername(name))[4] IS NULL
  AND EXISTS (
    SELECT 1 FROM public.at_assignments a
    JOIN public.at_organization_members m
      ON m.organization_id=a.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'driver'
    WHERE a.organization_id::text = (storage.foldername(name))[1]
      AND a.id::text = (storage.foldername(name))[2]
      AND a.driver_user_id = (SELECT auth.uid())
      AND a.status = 'in_transit'
  )
);

-- Private evidence can be downloaded only by the assigned driver or org dispatch.
-- Objects are never made public.
CREATE POLICY "Scoped evidence read access"
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='at-delivery-evidence'
  AND EXISTS (
    SELECT 1 FROM public.at_assignments a
    JOIN public.at_organization_members m
      ON m.organization_id=a.organization_id
      AND m.user_id=(SELECT auth.uid())
    WHERE a.organization_id::text = (storage.foldername(name))[1]
      AND a.id::text = (storage.foldername(name))[2]
      AND (
        m.role IN ('admin','dispatcher')
        OR (m.role='driver' AND a.driver_user_id=(SELECT auth.uid())
          AND (storage.foldername(name))[3]=(SELECT auth.uid())::text)
      )
  )
);

-- Backstop for *any* writer (including trusted services): status cannot
-- leave the pickup stage with unfinished courier manifest scans, nor reach
-- delivered without a saved proof record. Row locks serialize scan/status work.
CREATE FUNCTION at_private.guard_delivery_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.division='Class C' AND OLD.status='at_pickup'
      AND NEW.status='picked_up' AND EXISTS (
        SELECT 1 FROM public.at_assignment_packages p
        WHERE p.organization_id=OLD.organization_id
          AND p.assignment_id=OLD.id AND p.status='pending'
      ) THEN
      RAISE EXCEPTION 'Scan all manifested courier packages before departure';
    END IF;
    IF NEW.status='delivered' THEN
      IF OLD.division='Class C' AND EXISTS (
        SELECT 1 FROM public.at_assignment_packages p
        WHERE p.organization_id=OLD.organization_id
          AND p.assignment_id=OLD.id AND p.status<>'delivered'
      ) THEN RAISE EXCEPTION 'Courier package manifest is not complete'; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.at_delivery_proofs p
        WHERE p.organization_id=OLD.organization_id AND p.assignment_id=OLD.id
      ) THEN RAISE EXCEPTION 'A verified proof of delivery is required'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER at_guard_delivery_status
BEFORE UPDATE OF status ON public.at_assignments
FOR EACH ROW EXECUTE FUNCTION at_private.guard_delivery_status();

-- Calls are serialized on each assignment row; immutable package events are
-- inserted atomically with the package status change.
CREATE FUNCTION at_private.scan_package(
  p_assignment_id uuid, p_tracking_code text, p_scan_type text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_assignment public.at_assignments%ROWTYPE;
  v_package public.at_assignment_packages%ROWTYPE;
  v_next text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_assignment FROM public.at_assignments
   WHERE id=p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF v_assignment.division <> 'Class C'
    OR v_assignment.driver_user_id IS DISTINCT FROM v_actor
    OR NOT EXISTS (
      SELECT 1 FROM public.at_organization_members
      WHERE organization_id=v_assignment.organization_id
        AND user_id=v_actor AND role='driver'
    ) THEN RAISE EXCEPTION 'Courier assignment authorization required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.at_driver_profiles d
    WHERE d.organization_id=v_assignment.organization_id
      AND d.user_id=v_actor AND d.license_verified=true
  ) THEN RAISE EXCEPTION 'Driver license verification required'; END IF;
  IF p_scan_type='pickup' AND v_assignment.status='at_pickup' THEN
    v_next := 'picked_up';
  ELSIF p_scan_type='delivery' AND v_assignment.status='in_transit' THEN
    v_next := 'delivered';
  ELSE
    RAISE EXCEPTION 'Invalid package scan for current assignment status';
  END IF;

  SELECT * INTO v_package FROM public.at_assignment_packages
  WHERE organization_id=v_assignment.organization_id
    AND assignment_id=p_assignment_id
    AND tracking_code=trim(p_tracking_code)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tracking code not on manifest'; END IF;
  IF (p_scan_type='pickup' AND v_package.status<>'pending')
     OR (p_scan_type='delivery' AND v_package.status<>'picked_up') THEN
    RAISE EXCEPTION 'Package already processed or pickup scan missing';
  END IF;
  UPDATE public.at_assignment_packages
    SET status=v_next,
      picked_up_at=CASE WHEN p_scan_type='pickup' THEN now() ELSE picked_up_at END,
      delivered_at=CASE WHEN p_scan_type='delivery' THEN now() ELSE delivered_at END
    WHERE id=v_package.id;
  INSERT INTO public.at_package_events
    (organization_id,assignment_id,package_id,actor_user_id,action)
    VALUES (v_assignment.organization_id,p_assignment_id,v_package.id,v_actor,p_scan_type);
  RETURN jsonb_build_object('package_id',v_package.id,'status',v_next);
END;
$$;

CREATE FUNCTION at_private.confirm_delivery(
  p_assignment_id uuid, p_recipient_name text, p_evidence_path text, p_notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_assignment public.at_assignments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_assignment FROM public.at_assignments
    WHERE id=p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF v_assignment.status <> 'in_transit'
    OR v_assignment.driver_user_id IS DISTINCT FROM v_actor
    OR NOT EXISTS (
      SELECT 1 FROM public.at_organization_members
      WHERE organization_id=v_assignment.organization_id
        AND user_id=v_actor AND role='driver'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.at_driver_profiles
      WHERE organization_id=v_assignment.organization_id
        AND user_id=v_actor AND license_verified=true
    ) THEN RAISE EXCEPTION 'Driver not authorized to complete this assignment'; END IF;
  IF length(trim(coalesce(p_recipient_name,''))) NOT BETWEEN 2 AND 120
     OR length(coalesce(p_notes,'')) > 1000 THEN
    RAISE EXCEPTION 'Invalid proof-of-delivery details';
  END IF;

  -- Every listed courier package must have a successful delivery scan.
  IF v_assignment.division='Class C' AND EXISTS (
    SELECT 1 FROM public.at_assignment_packages
    WHERE assignment_id=p_assignment_id AND organization_id=v_assignment.organization_id
      AND status <> 'delivered'
  ) THEN RAISE EXCEPTION 'Some courier packages are not marked delivered'; END IF;

  IF p_evidence_path IS NULL
    OR length(p_evidence_path) > 255
    OR split_part(p_evidence_path,'/',1) <> v_assignment.organization_id::text
    OR split_part(p_evidence_path,'/',2) <> v_assignment.id::text
    OR split_part(p_evidence_path,'/',3) <> v_actor::text
    OR split_part(p_evidence_path,'/',4) = ''
    OR split_part(p_evidence_path,'/',5) <> '' THEN
    RAISE EXCEPTION 'Evidence path does not belong to this assignment and driver';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id='at-delivery-evidence' AND name=p_evidence_path
  ) THEN RAISE EXCEPTION 'Uploaded evidence was not found'; END IF;
  INSERT INTO public.at_delivery_proofs
    (organization_id,assignment_id,driver_user_id,recipient_name,evidence_path,notes)
  VALUES (v_assignment.organization_id,p_assignment_id,v_actor,trim(p_recipient_name),
    p_evidence_path,coalesce(p_notes,''));
  UPDATE public.at_assignments SET status='delivered',updated_at=now()
    WHERE id=p_assignment_id;
  INSERT INTO public.at_assignment_events
    (organization_id,assignment_id,actor_user_id,action,previous_status,next_status)
  VALUES (v_assignment.organization_id,p_assignment_id,v_actor,'deliver',
    'in_transit','delivered');
  RETURN jsonb_build_object('id',p_assignment_id,'status','delivered');
END;
$$;

CREATE FUNCTION public.at_scan_package(
  p_assignment_id uuid, p_tracking_code text, p_scan_type text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT at_private.scan_package(p_assignment_id,p_tracking_code,p_scan_type) $$;

CREATE FUNCTION public.at_confirm_delivery(
  p_assignment_id uuid, p_recipient_name text, p_evidence_path text, p_notes text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT at_private.confirm_delivery(p_assignment_id,p_recipient_name,p_evidence_path,p_notes) $$;

REVOKE ALL ON FUNCTION at_private.scan_package(uuid,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION at_private.confirm_delivery(uuid,text,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.at_scan_package(uuid,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.at_confirm_delivery(uuid,text,text,text)
  FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION at_private.scan_package(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION at_private.confirm_delivery(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.at_scan_package(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.at_confirm_delivery(uuid,text,text,text) TO authenticated;