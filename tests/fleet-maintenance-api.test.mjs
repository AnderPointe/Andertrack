import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 DVIR_DEFECT_TYPES,DVIR_LEVELS,validateDvirSubmission,validateWorkOrder,
 loadSafetyRecords,submitAuthenticatedDvir,createAuthenticatedWorkOrder,
 updateAuthenticatedWorkOrder,reviewAuthenticatedDvir,serviceOrderSummary,dvirSummary,
} from '../src/lib/fleet-maintenance-api.js';

const payload={organizationId:'org-a',vehicleId:'v1',assignmentId:'a1',
 defectType:'Brake system',severity:'out-of-service',notes:'Brake travel excessive',
 attested:true};
test('DVIR requires an explicit driver attestation, authorized IDs and approved defect types',()=>{
 assert.equal(validateDvirSubmission(payload).valid,true);
 assert.equal(validateDvirSubmission({...payload,attested:false}).valid,false);
 assert.equal(validateDvirSubmission({...payload,vehicleId:''}).valid,false);
 assert.equal(validateDvirSubmission({...payload,defectType:'Not listed'}).valid,false);
 assert.equal(validateDvirSubmission({...payload,severity:'cleared'}).valid,false);
 assert.equal(validateDvirSubmission({...payload,notes:'x'.repeat(1501)}).valid,false);
 assert.ok(DVIR_DEFECT_TYPES.includes('Brake system'));
 assert.ok(DVIR_LEVELS.includes('out-of-service'));
});
test('service orders require a real scoped vehicle and valid task before RPC',()=>{
 assert.equal(validateWorkOrder({organizationId:'org-a',vehicleId:'v1',task:'Inspect tires'}).valid,true);
 assert.equal(validateWorkOrder({organizationId:'org-a',vehicleId:'',task:'Inspect tires'}).valid,false);
 assert.equal(validateWorkOrder({organizationId:'org-a',vehicleId:'v1',task:'x'}).valid,false);
 assert.equal(validateWorkOrder({organizationId:'org-a',vehicleId:'v1',task:'Inspect tires',scheduledAt:'bad-date'}).valid,false);
});
function query(rows,error=null){
 const q={
  select(){return this;},eq(){return this;},order(){return this;},
  limit(){return this;},
  then(resolve){return Promise.resolve({data:rows,error}).then(resolve);}
 };
 return q;
}
test('maintenance reads are RLS-backed and fail closed when migration is absent',async()=>{
 const configured=await loadSafetyRecords({
  from(table){
   return query(table==='at_vehicle_dvir_reports'?[{id:'r1',status:'submitted'}]:[{id:'o1',status:'scheduled'}]);
  }
 },{organizationId:'org-a',driverOnly:true,currentUserId:'driver-a'});
 assert.equal(configured.configured,true);
 assert.equal(configured.reports.length,1);
 assert.equal(configured.orders.length,1);
 const missing=await loadSafetyRecords({
  from(){return query([],{message:'relation does not exist',code:'42P01'});}
 },{organizationId:'org-a'});
 assert.equal(missing.configured,false);
 assert.deepEqual(missing.reports,[]);
 assert.deepEqual(missing.orders,[]);
 assert.equal((await loadSafetyRecords(null,{organizationId:'org-a'})).configured,false);
});
test('submission calls server-defined RPC and cannot be faked by local app state',async()=>{
 let sent=null;
 const client={async rpc(name,params){sent={name,params};return {data:'report-123',error:null};}};
 const id=await submitAuthenticatedDvir(client,payload);
 assert.equal(id,'report-123');
 assert.equal(sent.name,'at_submit_vehicle_dvir');
 assert.equal(sent.params.p_attested,true);
 assert.equal(sent.params.p_assignment_id,'a1');
 assert.equal(sent.params.p_organization_id,'org-a');
 await assert.rejects(submitAuthenticatedDvir(client,{...payload,attested:false}));
 assert.equal(sent.name,'at_submit_vehicle_dvir');
});
test('work orders use the assigned server audit RPC and enforce status transitions',async()=>{
 const calls=[],client={async rpc(name,params){
  calls.push({name,params});return {data:'order-123',error:null};
 }};
 assert.equal(await createAuthenticatedWorkOrder(client,{
  organizationId:'org-a',vehicleId:'v1',task:'Brake inspection',
  workshop:'Garage A',scheduledAt:null,sourceDvirId:'report-123',
 }), 'order-123');
 await updateAuthenticatedWorkOrder(client,{orderId:'order-123',nextStatus:'in_service',notes:''});
 await reviewAuthenticatedDvir(client,{reportId:'report-123',nextStatus:'repair_required',
  notes:'Inspection confirmed.'});
 assert.deepEqual(calls.map(x=>x.name),
  ['at_create_service_work_order','at_update_service_work_order','at_review_vehicle_dvir']);
 assert.equal(calls[0].params.p_source_dvir_id,'report-123');
 await assert.rejects(updateAuthenticatedWorkOrder(client,{orderId:'order-123',nextStatus:'road_cleared'}));
 await assert.rejects(reviewAuthenticatedDvir(client,{reportId:'report-123',nextStatus:'closed',notes:'ok'}));
});
test('counts are derived from genuine returned records only',()=>{
 assert.deepEqual(dvirSummary([
  {status:'submitted',severity:'needs-review'},
  {status:'repair_required',severity:'out-of-service'},
  {status:'closed',severity:'out-of-service'}]),
  {total:3,unreviewed:1,safetyOpen:1});
 assert.deepEqual(serviceOrderSummary([
  {status:'scheduled'},{status:'in_service'},{status:'completed'},{status:'cancelled'}]),
  {open:2,completed:1,awaiting:1});
});
