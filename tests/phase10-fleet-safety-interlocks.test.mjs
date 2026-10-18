import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dispatchMatches} from '../src/lib/dispatch-planner.js';
import {normalizeSafetySnapshot,screenVehicleSafety,SAFETY_REASONS}
 from '../src/lib/fleet-safety-interlocks.js';
import {loadDispatchSafetySnapshot} from '../src/lib/fleet-maintenance-api.js';

const now=Date.parse('2026-10-18T06:00:00Z');
const org='org-one';
const v={id:'vehicle-one',enabled:true,unit_number:'V-1',required_license_class:'C',vehicle_type:'cargo_van'};
const load={id:'load-one',division:'Class C',status:'unassigned',driver_user_id:null};
const driver={user_id:'driver-one',display_name:'Operator',availability:'available',
  license_verified:true,license_class:'C'};
const candidates=(snapshot)=>dispatchMatches({load,vehicles:[v],drivers:[driver],
  assignments:[load],safetySnapshot:snapshot,safetyOrganizationId:org,now});

test('verified current snapshot screens every included unit and keeps severe holds',()=>{
 const snapshot=normalizeSafetySnapshot([
  {vehicle_id:'vehicle-one',open_out_of_service:0},
  {vehicle_id:'vehicle-two',open_out_of_service:2},
 ],org,now);
 assert.deepEqual(snapshot.holds,['vehicle-two']);
 assert.deepEqual(snapshot.coveredVehicleIds,['vehicle-one','vehicle-two']);
 assert.equal(screenVehicleSafety(snapshot,'vehicle-one',{organizationId:org,now}).eligible,true);
 const held=screenVehicleSafety(snapshot,'vehicle-two',{organizationId:org,now});
 assert.equal(held.eligible,false);
 assert.equal(held.reason,SAFETY_REASONS.HOLD);
});
test('unknown, cross-tenant, stale and partial safety snapshots never appear clear',()=>{
 const good=normalizeSafetySnapshot([{vehicle_id:'vehicle-one',open_out_of_service:0}],org,now);
 const cases=[
  screenVehicleSafety(good,'vehicle-one',{organizationId:'other',now}),
  screenVehicleSafety(good,'vehicle-one',{organizationId:org,now:now+60001}),
  screenVehicleSafety(good,'unseen-unit',{organizationId:org,now}),
  screenVehicleSafety(null,'vehicle-one',{organizationId:org,now}),
  screenVehicleSafety({state:'ready',organizationId:org,holds:[],checkedAt:now},
    'vehicle-one',{organizationId:org,now}),
 ];
 for(const value of cases){assert.equal(value.eligible,false);assert.equal(value.state,'unknown');}
 assert.equal(normalizeSafetySnapshot([{vehicle_id:'v',open_out_of_service:-1}],org,now).state,'unavailable');
 assert.equal(normalizeSafetySnapshot([
  {vehicle_id:'v',open_out_of_service:0},{vehicle_id:'v',open_out_of_service:0},
 ],org,now).state,'unavailable');
});
test('dispatch ranking never recommends an OOS or unverified vehicle',()=>{
 const clear=normalizeSafetySnapshot([{vehicle_id:v.id,open_out_of_service:0}],org,now);
 const held=normalizeSafetySnapshot([{vehicle_id:v.id,open_out_of_service:1}],org,now);
 const omitted=normalizeSafetySnapshot([],org,now);
 assert.equal(candidates(clear)[0].eligible,true);
 assert.equal(candidates(held)[0].eligible,false);
 assert.equal(candidates(omitted)[0].eligible,false);
 assert.ok(candidates(held)[0].reasons.includes(SAFETY_REASONS.HOLD));
 assert.ok(candidates(omitted)[0].reasons.includes(SAFETY_REASONS.UNKNOWN));
 assert.equal(candidates({...clear,organizationId:'other'})[0].eligible,false);
});
test('safety evidence RPC fails closed on backend errors and unexpected payloads',async()=>{
 const client={rpc:async(name,args)=>{
  assert.equal(name,'at_dispatch_vehicle_safety_status');
  assert.equal(args.p_organization_id,org);
  return {data:[{vehicle_id:v.id,open_out_of_service:1}],error:null};
 }};
 assert.equal((await loadDispatchSafetySnapshot(client,{organizationId:org}))[0].vehicle_id,v.id);
 await assert.rejects(loadDispatchSafetySnapshot({rpc:async()=>({data:null,error:{message:'backend missing'}})},
   {organizationId:org}),/backend missing/);
 await assert.rejects(loadDispatchSafetySnapshot({rpc:async()=>({data:{},error:null})},
   {organizationId:org}),/incomplete/);
});
test('review-only database migration protects offers and acceptances, RLS-scoped reads',()=>{
 const sql=readFileSync(new URL('../supabase/sql/phase10_dispatch_safety_interlock_review.sql',import.meta.url),'utf8');
 assert.match(sql,/REVIEW ONLY/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OF status,vehicle_id,driver_user_id/);
 assert.match(sql,/NEW.status IN \('offered','assigned','accepted','at_pickup','picked_up','in_transit'\)/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OF severity,status,vehicle_id,organization_id/);
 assert.match(sql,/out-of-service' AND d.status<>'closed'/);
 assert.match(sql,/FOR UPDATE;/);
 assert.match(sql,/at_phase10_serialize_severe_dvir/);
 assert.match(sql,/at_phase10_dispatch_safety/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/auth.uid\(\)/);
 assert.match(sql,/m.role IN \('admin','dispatcher'\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.at_dispatch_vehicle_safety_status\(uuid\)/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE) ON public.at_vehicle_dvir_reports/);
});
