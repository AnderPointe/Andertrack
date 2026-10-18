-- ANDERTRACK STAGING ONLY. NO PRODUCTION USE.
-- Repeatable, authenticated-role SQL simulation. Fake fixtures are rolled back.
-- Not equivalent to real GoTrue sign-in or a two-connection race test.
BEGIN;
SET LOCAL statement_timeout = '20s';
DO $fixture$
DECLARE
 org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
 admin_a uuid:=gen_random_uuid(); driver_a uuid:=gen_random_uuid();
 driver_offer uuid:=gen_random_uuid(); driver_queue uuid:=gen_random_uuid();
 driver_b uuid:=gen_random_uuid();
 vehicle_held uuid:=gen_random_uuid(); vehicle_safe uuid:=gen_random_uuid();
 vehicle_offered uuid:=gen_random_uuid(); vehicle_b uuid:=gen_random_uuid();
 load_held uuid:=gen_random_uuid(); load_offered uuid:=gen_random_uuid();
 load_queue uuid:=gen_random_uuid(); load_safe uuid:=gen_random_uuid();
 load_b uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at)
 SELECT '00000000-0000-0000-0000-000000000000'::uuid,t.id,
  'authenticated','authenticated','phase10-rollback-'||t.id||'@example.invalid',
  clock_timestamp(),clock_timestamp()
 FROM (VALUES(admin_a),(driver_a),(driver_offer),(driver_queue),(driver_b)) AS t(id);
 INSERT INTO public.at_organizations(id,name) VALUES
  (org_a,'P10 rollback A'),(org_b,'P10 rollback B');
 INSERT INTO public.at_organization_members(organization_id,user_id,role) VALUES
  (org_a,admin_a,'dispatcher'),(org_a,driver_a,'driver'),
  (org_a,driver_offer,'driver'),(org_a,driver_queue,'driver'),(org_b,driver_b,'driver');
 INSERT INTO public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
 VALUES (org_a,driver_a,'P10 Driver A','C',true,'available'),
  (org_a,driver_offer,'P10 Driver Offer','C',true,'available'),
  (org_a,driver_queue,'P10 Driver Queue','C',true,'available'),
  (org_b,driver_b,'P10 Driver B','C',true,'available');
 INSERT INTO public.at_vehicles(id,organization_id,unit_number,vehicle_type,required_license_class)
 VALUES (vehicle_held,org_a,'P10-HOLD','cargo_van','C'),
  (vehicle_safe,org_a,'P10-SAFE','cargo_van','C'),
  (vehicle_offered,org_a,'P10-OFFER','cargo_van','C'),
  (vehicle_b,org_b,'P10-BETA','cargo_van','C');
 INSERT INTO public.at_assignments
 (id,organization_id,reference,division,customer_name,commodity,
  pickup_address,dropoff_address,vehicle_id,driver_user_id,status)
 VALUES
 (load_held,org_a,'P10-HELD','Class C','Test','Parcel','A','B',vehicle_held,driver_a,'accepted'),
 (load_offered,org_a,'P10-OFFER','Class C','Test','Parcel','A','B',vehicle_offered,driver_offer,'offered'),
 (load_queue,org_a,'P10-QUEUE','Class C','Test','Parcel','A','B',NULL,NULL,'unassigned'),
 (load_safe,org_a,'P10-SAFE','Class C','Test','Parcel','A','B',NULL,NULL,'unassigned'),
 (load_b,org_b,'P10-BETA','Class C','Test','Parcel','A','B',vehicle_b,driver_b,'accepted');
 INSERT INTO public.at_vehicle_dvir_reports
  (organization_id,vehicle_id,assignment_id,driver_user_id,defect_type,severity,notes)
 VALUES
  (org_a,vehicle_held,load_held,driver_a,'Brake system','out-of-service','Rollback defect'),
  (org_a,vehicle_offered,load_offered,driver_offer,'Steering','out-of-service','Rollback defect'),
  (org_b,vehicle_b,load_b,driver_b,'Brake system','out-of-service','Rollback defect');
 INSERT INTO public.at_dispatch_requests(organization_id,driver_user_id,status)
 VALUES(org_a,driver_queue,'queued');
 PERFORM set_config('app.phase10_test_ids',jsonb_build_object(
  'org_a',org_a,'org_b',org_b,'admin_a',admin_a,'driver_a',driver_a,
  'driver_offer',driver_offer,'driver_queue',driver_queue,
  'vehicle_held',vehicle_held,'vehicle_safe',vehicle_safe,
  'load_held',load_held,'load_offered',load_offered,
  'load_queue',load_queue,'load_safe',load_safe)::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $tests$
DECLARE
 v jsonb:=current_setting('app.phase10_test_ids')::jsonb;
 passed text[]:=ARRAY[]::text[]; n bigint;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',v->>'admin_a',true);
 SELECT count(*) INTO n FROM public.at_dispatch_vehicle_safety_status((v->>'org_a')::uuid);
 IF n<>3 THEN RAISE EXCEPTION 'Incorrect planner snapshot row count: %',n; END IF;
 SELECT coalesce(sum(open_out_of_service),0) INTO n
  FROM public.at_dispatch_vehicle_safety_status((v->>'org_a')::uuid);
 IF n<>2 THEN RAISE EXCEPTION 'Incorrect severe defect count: %',n; END IF;
 passed:=array_append(passed,'scoped_snapshot');
 BEGIN
  PERFORM 1 FROM public.at_dispatch_vehicle_safety_status((v->>'org_b')::uuid);
  RAISE EXCEPTION 'Foreign-org snapshot wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Planner organization membership required%' THEN RAISE; END IF;
 END;
 passed:=array_append(passed,'foreign_snapshot_denied');
 SELECT count(*) INTO n FROM public.at_vehicle_dvir_reports
  WHERE organization_id=(v->>'org_b')::uuid;
 IF n<>0 THEN RAISE EXCEPTION 'RLS leaked foreign reports'; END IF;
 passed:=array_append(passed,'cross_tenant_rls');
 BEGIN
  PERFORM public.at_offer_assignment((v->>'load_safe')::uuid,
   (v->>'driver_queue')::uuid,(v->>'vehicle_held')::uuid);
  RAISE EXCEPTION 'OOS offer wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%out-of-service DVIR safety hold%' THEN RAISE; END IF;
 END;
 passed:=array_append(passed,'offer_blocked');
 BEGIN
  PERFORM public.at_claim_next_dispatch((v->>'org_a')::uuid,
   (v->>'load_queue')::uuid,(v->>'vehicle_held')::uuid);
  RAISE EXCEPTION 'OOS queue claim wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%out-of-service DVIR safety hold%' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM public.at_dispatch_requests WHERE
   organization_id=(v->>'org_a')::uuid AND status='queued' AND assignment_id IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Blocked FIFO claim consumed queue'; END IF;
 passed:=array_append(passed,'fifo_blocked_head_preserved');
 PERFORM public.at_offer_assignment((v->>'load_safe')::uuid,
  (v->>'driver_queue')::uuid,(v->>'vehicle_safe')::uuid);
 passed:=array_append(passed,'safe_offer');
 PERFORM set_config('request.jwt.claim.sub',v->>'driver_offer',true);
 BEGIN
  PERFORM public.at_respond_assignment((v->>'load_offered')::uuid,true);
  RAISE EXCEPTION 'OOS acceptance wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%out-of-service DVIR safety hold%' THEN RAISE; END IF;
 END;
 passed:=array_append(passed,'acceptance_blocked');
 PERFORM public.at_respond_assignment((v->>'load_offered')::uuid,false);
 passed:=array_append(passed,'decline_allowed');
 PERFORM set_config('request.jwt.claim.sub',v->>'driver_a',true);
 BEGIN
  PERFORM public.at_advance_assignment((v->>'load_held')::uuid,'at_pickup');
  RAISE EXCEPTION 'OOS progress wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%out-of-service DVIR safety hold%' THEN RAISE; END IF;
 END;
 passed:=array_append(passed,'progress_blocked');
 PERFORM public.at_submit_vehicle_dvir((v->>'org_a')::uuid,
  (v->>'vehicle_held')::uuid,(v->>'load_held')::uuid,
  'Steering','out-of-service','Rollback-only driver confirmation',true);
 passed:=array_append(passed,'owned_dvir_submission');
 BEGIN
  PERFORM 1 FROM public.at_dispatch_vehicle_safety_status((v->>'org_a')::uuid);
  RAISE EXCEPTION 'Driver planner RPC wrongly allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Planner organization membership required%' THEN RAISE; END IF;
 END;
 passed:=array_append(passed,'driver_planner_denied');
 PERFORM set_config('app.phase10_test_results',array_to_json(passed)::text,true);
END $tests$;
SELECT current_setting('app.phase10_test_results') AS passed_checks;
ROLLBACK;
