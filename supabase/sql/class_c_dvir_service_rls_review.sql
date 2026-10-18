-- REVIEW ONLY. Do not run on production without approval.
-- Class C driver defect reporting + dispatcher service work order foundation.
-- Protected, append-only audit events; no operational vehicle automatic release.
-- All authenticated writes MUST use SECURITY DEFINER RPCs with tenant/role checks.
BEGIN;

CREATE TABLE IF NOT EXISTS public.at_vehicle_dvir_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.at_organizations(id),
  vehicle_id uuid NOT NULL REFERENCES public.at_vehicles(id),
  assignment_id uuid NOT NULL REFERENCES public.at_assignments(id),
  driver_user_id uuid NOT NULL,
  defect_type text NOT NULL CHECK (defect_type IN (
    'Brake system','Tires and wheels','Lights and signals','Steering',
    'Engine or transmission','Other safety issue')),
  severity text NOT NULL CHECK (severity IN ('needs-review','out-of-service')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes)<=1500),
  driver_attested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted' CHECK
    (status IN ('submitted','acknowledged','repair_required','closed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text CHECK (review_notes IS NULL OR char_length(review_notes)<=1500),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_dvir_review_state CHECK (
    (status='submitted' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status<>'submitted' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS at_dvir_org_recent_idx
 ON public.at_vehicle_dvir_reports(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS at_dvir_vehicle_open_idx
 ON public.at_vehicle_dvir_reports(vehicle_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS at_dvir_driver_idx
 ON public.at_vehicle_dvir_reports(driver_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.at_vehicle_service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.at_organizations(id),
  vehicle_id uuid NOT NULL REFERENCES public.at_vehicles(id),
  source_dvir_id uuid REFERENCES public.at_vehicle_dvir_reports(id),
  created_by uuid NOT NULL,
  work_type text NOT NULL CHECK (char_length(trim(work_type)) BETWEEN 3 AND 160),
  workshop text NOT NULL DEFAULT 'Unassigned' CHECK (char_length(workshop)<=120),
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_service','completed','cancelled')),
  completion_notes text CHECK (completion_notes IS NULL OR char_length(completion_notes)<=1500),
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS at_service_org_idx
 ON public.at_vehicle_service_orders(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS at_service_vehicle_idx
 ON public.at_vehicle_service_orders(vehicle_id,scheduled_at DESC);
CREATE INDEX IF NOT EXISTS at_service_dvir_idx
 ON public.at_vehicle_service_orders(source_dvir_id);

CREATE TABLE IF NOT EXISTS public.at_vehicle_safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.at_organizations(id),
  actor_user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.at_vehicles(id),
  dvir_id uuid REFERENCES public.at_vehicle_dvir_reports(id),
  service_order_id uuid REFERENCES public.at_vehicle_service_orders(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS at_safety_events_org_idx
 ON public.at_vehicle_safety_events(organization_id,occurred_at DESC);

ALTER TABLE public.at_vehicle_dvir_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.at_vehicle_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.at_vehicle_safety_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.at_vehicle_dvir_reports,public.at_vehicle_service_orders,
  public.at_vehicle_safety_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.at_vehicle_dvir_reports,public.at_vehicle_service_orders,
  public.at_vehicle_safety_events TO authenticated;

DROP POLICY IF EXISTS at_dvir_scoped_read ON public.at_vehicle_dvir_reports;
CREATE POLICY at_dvir_scoped_read ON public.at_vehicle_dvir_reports FOR SELECT
 TO authenticated USING (
   EXISTS (SELECT 1 FROM public.at_organization_members m
     WHERE m.organization_id=at_vehicle_dvir_reports.organization_id
       AND m.user_id=auth.uid() AND (
        m.role IN ('admin','dispatcher') OR
        (m.role='driver' AND at_vehicle_dvir_reports.driver_user_id=auth.uid())
       ))
 );
DROP POLICY IF EXISTS at_service_scoped_read ON public.at_vehicle_service_orders;
CREATE POLICY at_service_scoped_read ON public.at_vehicle_service_orders FOR SELECT
 TO authenticated USING (
   EXISTS (SELECT 1 FROM public.at_organization_members m
    WHERE m.organization_id=at_vehicle_service_orders.organization_id
      AND m.user_id=auth.uid() AND (
        m.role IN ('admin','dispatcher') OR
        (m.role='driver' AND EXISTS
          (SELECT 1 FROM public.at_vehicle_dvir_reports d
           WHERE d.id=at_vehicle_service_orders.source_dvir_id
             AND d.organization_id=m.organization_id AND d.driver_user_id=auth.uid()))
      ))
 );
DROP POLICY IF EXISTS at_safety_events_scoped_read ON public.at_vehicle_safety_events;
CREATE POLICY at_safety_events_scoped_read ON public.at_vehicle_safety_events FOR SELECT
 TO authenticated USING (
   EXISTS (SELECT 1 FROM public.at_organization_members m
    WHERE m.organization_id=at_vehicle_safety_events.organization_id
      AND m.user_id=auth.uid() AND (
        m.role IN ('admin','dispatcher') OR
        (m.role='driver' AND at_vehicle_safety_events.actor_user_id=auth.uid())
      ))
 );

-- A driver may only submit an attested defect for an assignment they currently
-- own in this org, which references the same vehicle. No client-set actor/time.
CREATE OR REPLACE FUNCTION public.at_submit_vehicle_dvir(
  p_organization_id uuid,p_vehicle_id uuid,p_assignment_id uuid,
  p_defect_type text,p_severity text,p_notes text,p_attested boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid; v_note text := trim(coalesce(p_notes,''));
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_attested IS DISTINCT FROM true THEN RAISE EXCEPTION 'Driver confirmation required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_organization_members m WHERE
    m.organization_id=p_organization_id AND m.user_id=v_user AND m.role='driver')
 THEN RAISE EXCEPTION 'Driver organization membership required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_assignments a JOIN public.at_vehicles v
  ON v.id=a.vehicle_id AND v.organization_id=a.organization_id
  WHERE a.id=p_assignment_id AND a.organization_id=p_organization_id
   AND a.driver_user_id=v_user AND a.vehicle_id=p_vehicle_id
   AND a.status IN ('assigned','accepted','at_pickup','picked_up','in_transit'))
 THEN RAISE EXCEPTION 'No current owned assignment for this vehicle'; END IF;
 IF p_defect_type NOT IN ('Brake system','Tires and wheels','Lights and signals',
     'Steering','Engine or transmission','Other safety issue')
    OR p_severity NOT IN ('needs-review','out-of-service')
    OR char_length(v_note)>1500 THEN
    RAISE EXCEPTION 'Invalid DVIR details'; END IF;
 INSERT INTO public.at_vehicle_dvir_reports
  (organization_id,vehicle_id,assignment_id,driver_user_id,
   defect_type,severity,notes)
 VALUES (p_organization_id,p_vehicle_id,p_assignment_id,v_user,
         p_defect_type,p_severity,v_note)
 RETURNING id INTO v_id;
 INSERT INTO public.at_vehicle_safety_events
  (organization_id,actor_user_id,vehicle_id,dvir_id,action,details)
 VALUES (p_organization_id,v_user,p_vehicle_id,v_id,'dvir_submitted',
    pg_catalog.jsonb_build_object('severity',p_severity,'defect_type',p_defect_type));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.at_submit_vehicle_dvir(uuid,uuid,uuid,text,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.at_submit_vehicle_dvir(uuid,uuid,uuid,text,text,text,boolean)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.at_create_service_work_order(
 p_organization_id uuid,p_vehicle_id uuid,p_work_type text,
 p_workshop text,p_scheduled_at timestamptz,p_source_dvir_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid; v_work text := trim(coalesce(p_work_type,''));
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_organization_members m
   WHERE m.organization_id=p_organization_id AND m.user_id=v_user
     AND m.role IN ('admin','dispatcher'))
 THEN RAISE EXCEPTION 'Fleet planner access required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_vehicles v
    WHERE v.id=p_vehicle_id AND v.organization_id=p_organization_id)
 THEN RAISE EXCEPTION 'Equipment is not in this organization'; END IF;
 IF p_source_dvir_id IS NOT NULL AND NOT EXISTS
  (SELECT 1 FROM public.at_vehicle_dvir_reports d
   WHERE d.id=p_source_dvir_id AND d.organization_id=p_organization_id
     AND d.vehicle_id=p_vehicle_id AND d.status<>'closed')
 THEN RAISE EXCEPTION 'Source defect does not match this open vehicle report'; END IF;
 IF char_length(v_work)<3 OR char_length(v_work)>160
    OR char_length(coalesce(p_workshop,''))>120
 THEN RAISE EXCEPTION 'Invalid service order fields'; END IF;
 INSERT INTO public.at_vehicle_service_orders
  (organization_id,vehicle_id,source_dvir_id,created_by,work_type,workshop,scheduled_at)
 VALUES (p_organization_id,p_vehicle_id,p_source_dvir_id,v_user,v_work,
  coalesce(nullif(trim(p_workshop),''),'Unassigned'),p_scheduled_at)
 RETURNING id INTO v_id;
 INSERT INTO public.at_vehicle_safety_events
  (organization_id,actor_user_id,vehicle_id,dvir_id,service_order_id,action)
 VALUES (p_organization_id,v_user,p_vehicle_id,p_source_dvir_id,v_id,'service_created');
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.at_create_service_work_order(uuid,uuid,text,text,timestamptz,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.at_create_service_work_order(uuid,uuid,text,text,timestamptz,uuid)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.at_update_service_work_order(
 p_order_id uuid,p_next_status text,p_completion_notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid := auth.uid(); v_order public.at_vehicle_service_orders%ROWTYPE;
 v_notes text := trim(coalesce(p_completion_notes,''));
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_order FROM public.at_vehicle_service_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_organization_members m
   WHERE m.organization_id=v_order.organization_id AND m.user_id=v_user
     AND m.role IN ('admin','dispatcher'))
 THEN RAISE EXCEPTION 'Fleet planner access required'; END IF;
 IF NOT (
    (v_order.status='scheduled' AND p_next_status IN ('in_service','cancelled')) OR
    (v_order.status='in_service' AND p_next_status IN ('completed','cancelled'))
 ) THEN RAISE EXCEPTION 'Invalid work-order transition'; END IF;
 IF char_length(v_notes)>1500 OR (p_next_status='completed' AND char_length(v_notes)<6)
 THEN RAISE EXCEPTION 'Completion requires a meaningful note (6–1500 chars)'; END IF;
 UPDATE public.at_vehicle_service_orders SET status=p_next_status,
    completion_notes=CASE WHEN p_next_status='completed' THEN v_notes ELSE NULL END,
    completed_by=CASE WHEN p_next_status='completed' THEN v_user ELSE NULL END,
    completed_at=CASE WHEN p_next_status='completed' THEN now() ELSE NULL END,
    updated_at=now() WHERE id=p_order_id;
 INSERT INTO public.at_vehicle_safety_events
 (organization_id,actor_user_id,vehicle_id,dvir_id,service_order_id,action,details)
 VALUES (v_order.organization_id,v_user,v_order.vehicle_id,v_order.source_dvir_id,
   v_order.id,'service_'||p_next_status,
   pg_catalog.jsonb_build_object('previous_status',v_order.status,'new_status',p_next_status));
END $$;
REVOKE ALL ON FUNCTION public.at_update_service_work_order(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.at_update_service_work_order(uuid,text,text) TO authenticated;

-- Dispatcher review is audited. Closing OOS defects additionally requires
-- completed linked service order and a review note. This is NOT official DVIR
-- certification/vehicle release, only an administrative review event.
CREATE OR REPLACE FUNCTION public.at_review_vehicle_dvir(
 p_report_id uuid,p_next_status text,p_review_notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_user uuid := auth.uid(); v_report public.at_vehicle_dvir_reports%ROWTYPE;
 v_notes text:=trim(coalesce(p_review_notes,''));
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_report FROM public.at_vehicle_dvir_reports WHERE id=p_report_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Defect report not found'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.at_organization_members m WHERE
   m.organization_id=v_report.organization_id AND m.user_id=v_user
   AND m.role IN ('admin','dispatcher'))
 THEN RAISE EXCEPTION 'Fleet planner access required'; END IF;
 IF NOT (
   (v_report.status='submitted' AND p_next_status IN ('acknowledged','repair_required')) OR
   (v_report.status='acknowledged' AND p_next_status IN ('repair_required','closed')) OR
   (v_report.status='repair_required' AND p_next_status='closed')
 ) THEN RAISE EXCEPTION 'Invalid defect review transition'; END IF;
 IF char_length(v_notes)<6 OR char_length(v_notes)>1500
 THEN RAISE EXCEPTION 'Review note must be 6–1500 characters'; END IF;
 IF p_next_status='closed' AND v_report.severity='out-of-service'
   AND NOT EXISTS (SELECT 1 FROM public.at_vehicle_service_orders o WHERE
     o.source_dvir_id=v_report.id AND o.organization_id=v_report.organization_id
     AND o.vehicle_id=v_report.vehicle_id AND o.status='completed')
 THEN RAISE EXCEPTION 'Critical defect requires a completed linked service order'; END IF;
 UPDATE public.at_vehicle_dvir_reports SET status=p_next_status,
   reviewed_by=v_user,reviewed_at=now(),review_notes=v_notes,
   closed_at=CASE WHEN p_next_status='closed' THEN now() ELSE NULL END
 WHERE id=p_report_id;
 INSERT INTO public.at_vehicle_safety_events
   (organization_id,actor_user_id,vehicle_id,dvir_id,action,details)
 VALUES (v_report.organization_id,v_user,v_report.vehicle_id,p_report_id,
   'dvir_'||p_next_status,
   pg_catalog.jsonb_build_object('previous_status',v_report.status,'review_notes',v_notes));
END $$;
REVOKE ALL ON FUNCTION public.at_review_vehicle_dvir(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.at_review_vehicle_dvir(uuid,text,text) TO authenticated;

COMMENT ON TABLE public.at_vehicle_dvir_reports IS
 'Audited driver-reported defects; NOT a certified FMCSA DVIR signing or inspection system.';
COMMENT ON TABLE public.at_vehicle_service_orders IS
 'Dispatcher-entered maintenance tasks and completion notes, not verified mechanic clearance.';
COMMENT ON TABLE public.at_vehicle_safety_events IS
 'Append-only report/work-order audit events. No direct client write privileges.';
COMMIT;
