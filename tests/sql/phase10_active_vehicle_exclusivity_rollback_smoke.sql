-- Andertrack STAGING ONLY. Repeatable synthetic, rollback-only role simulation.
-- Validates existing-assignment conflict in direct offer and FIFO claim.
BEGIN;
SET LOCAL statement_timeout='20s';
DO $fixture$
DECLARE o uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
 driver_a uuid:=gen_random_uuid(); driver_b uuid:=gen_random_uuid();
 v uuid:=gen_random_uuid(); active_id uuid:=gen_random_uuid(); pending_id uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(instance_id,id,aud,role,email,created_at,updated_at)
 SELECT '00000000-0000-0000-0000-000000000000'::uuid,t.id,'authenticated','authenticated',
 'p10-exclusive-rollback-'||t.id||'@example.invalid',now(),now()
 FROM (VALUES(admin_id),(driver_a),(driver_b)) AS t(id);
 INSERT INTO public.at_organizations(id,name) VALUES(o,'P10 exclusivity rollback');
 INSERT INTO public.at_organization_members(organization_id,user_id,role)
 VALUES(o,admin_id,'dispatcher'),(o,driver_a,'driver'),(o,driver_b,'driver');
 INSERT INTO public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
 VALUES(o,driver_a,'P10 Existing Driver','C',true,'available'),
 (o,driver_b,'P10 Queued Driver','C',true,'available');
 INSERT INTO public.at_vehicles(id,organization_id,unit_number,vehicle_type,required_license_class)
 VALUES(v,o,'P10-ACTIVE-UNIT','cargo_van','C');
 INSERT INTO public.at_assignments(id,organization_id,reference,division,customer_name,commodity,
 pickup_address,dropoff_address,vehicle_id,driver_user_id,status)
 VALUES(active_id,o,'P10-ACTIVE','Class C','QA','Parcel','A','B',v,driver_a,'accepted'),
 (pending_id,o,'P10-PENDING','Class C','QA','Parcel','A','B',NULL,NULL,'unassigned');
 INSERT INTO public.at_dispatch_requests(organization_id,driver_user_id,status)
 VALUES(o,driver_b,'queued');
 PERFORM set_config('app.p10_ctx',jsonb_build_object('o',o,'admin_id',admin_id,
 'driver_b',driver_b,'v',v,'pending_id',pending_id)::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE ctx jsonb:=current_setting('app.p10_ctx')::jsonb;
 passes text[]:=ARRAY[]::text[]; n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',ctx->>'admin_id',true);
 BEGIN
  PERFORM public.at_offer_assignment((ctx->>'pending_id')::uuid,
   (ctx->>'driver_b')::uuid,(ctx->>'v')::uuid);
  RAISE EXCEPTION 'UNEXPECTED: duplicate equipment offer succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Vehicle has another active assignment; dispatch denied%' THEN RAISE; END IF;
 END;
 passes:=array_append(passes,'duplicate_equipment_offer_denied');
 BEGIN
  PERFORM public.at_claim_next_dispatch((ctx->>'o')::uuid,
   (ctx->>'pending_id')::uuid,(ctx->>'v')::uuid);
  RAISE EXCEPTION 'UNEXPECTED: duplicate equipment queue claim succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Vehicle has another active assignment; dispatch denied%' THEN RAISE; END IF;
 END;
 passes:=array_append(passes,'duplicate_equipment_fifo_denied');
 SELECT count(*) INTO n FROM public.at_dispatch_requests
 WHERE organization_id=(ctx->>'o')::uuid AND status='queued' AND assignment_id IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Rejected FIFO claim consumed the queue'; END IF;
 passes:=array_append(passes,'fifo_head_preserved');
 SELECT count(*) INTO n FROM public.at_assignments
 WHERE id=(ctx->>'pending_id')::uuid AND status='unassigned' AND vehicle_id IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Rejected offer mutated the unassigned shipment'; END IF;
 passes:=array_append(passes,'unassigned_load_intact');
 PERFORM set_config('app.p10_passes',array_to_json(passes)::text,true);
END $test$;
SELECT current_setting('app.p10_passes') AS passed_checks;
ROLLBACK;
