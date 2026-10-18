/** Authenticated service/DVIR client. RLS and SECURITY DEFINER RPCs are the
 * authorization boundary; never trust frontend role flags or raw unit labels. */
export const DVIR_DEFECT_TYPES=Object.freeze([
 'Brake system','Tires and wheels','Lights and signals',
 'Steering','Engine or transmission','Other safety issue'
]);
export const DVIR_LEVELS=Object.freeze(['needs-review','out-of-service']);
export const ORDER_STATUS=Object.freeze(['scheduled','in_service','completed','cancelled']);
export const DVIR_STATUS=Object.freeze(['submitted','acknowledged','repair_required','closed']);
export function validateDvirSubmission({
 organizationId,vehicleId,assignmentId,defectType,severity,notes='',attested=false,
}={}) {
 const valid=Boolean(organizationId&&vehicleId&&assignmentId&&attested===true&&
   DVIR_DEFECT_TYPES.includes(defectType)&&DVIR_LEVELS.includes(severity)&&
   String(notes).trim().length<=1500);
 return {valid,error:valid?'': 'Select your assigned unit, defect and severity; confirm personal observation.'};
}
export function validateWorkOrder({
 organizationId,vehicleId,task,workshop='Unassigned',scheduledAt=null,
}={}) {
 const t=String(task||'').trim(),w=String(workshop||'Unassigned').trim();
 const valid=Boolean(organizationId&&vehicleId&&t.length>=3&&t.length<=160&&
   w.length<=120&&(!scheduledAt||!Number.isNaN(Date.parse(scheduledAt))));
 return {valid,error:valid?'':'Choose an actual fleet unit and enter a service task (3–160 characters).'};
}
function fail(res) {
 if(res?.error)throw new Error(res.error.message||'Maintenance database operation failed');
 return res?.data;
}
function requireApi(client) {
 if(!client)throw new Error('Supabase connection is unavailable.');
 return client;
}
/** Returns configured=false on missing RLS/schema and never creates fake live records. */
export async function loadSafetyRecords(client,{organizationId,driverOnly=false,currentUserId=''}={}) {
 if(!client||!organizationId)return {configured:false,reports:[],orders:[],error:'Fleet connection unavailable.'};
 try {
  let q=client.from('at_vehicle_dvir_reports').select(
    'id,organization_id,vehicle_id,assignment_id,driver_user_id,defect_type,severity,notes,status,created_at,driver_attested_at,reviewed_at,review_notes,closed_at'
  ).eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
  if(driverOnly&&currentUserId)q=q.eq('driver_user_id',currentUserId);
  const reportResult=await q;
  if(reportResult.error)throw reportResult.error;
  let ordersQuery=client.from('at_vehicle_service_orders').select(
    'id,organization_id,vehicle_id,source_dvir_id,work_type,workshop,scheduled_at,status,completion_notes,created_at,completed_at'
  ).eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);
  // Service order visibility is enforced via RLS, not client-side filters.
  const ordersResult=await ordersQuery;
  if(ordersResult.error)throw ordersResult.error;
  return {configured:true,reports:reportResult.data||[],orders:ordersResult.data||[],error:''};
 } catch(err) {
  return {configured:false,reports:[],orders:[],error:err?.message||'Safety tables are unavailable.'};
 }
}
export async function submitAuthenticatedDvir(client,payload={}) {
 requireApi(client);
 const v=validateDvirSubmission(payload);
 if(!v.valid)throw new Error(v.error);
 const {data,error}=await client.rpc('at_submit_vehicle_dvir',{
  p_organization_id:payload.organizationId,p_vehicle_id:payload.vehicleId,
  p_assignment_id:payload.assignmentId,p_defect_type:payload.defectType,
  p_severity:payload.severity,p_notes:String(payload.notes||'').trim(),p_attested:true,
 });
 return fail({data,error});
}
export async function createAuthenticatedWorkOrder(client,payload={}) {
 requireApi(client);
 const v=validateWorkOrder(payload);
 if(!v.valid)throw new Error(v.error);
 const {data,error}=await client.rpc('at_create_service_work_order',{
  p_organization_id:payload.organizationId,p_vehicle_id:payload.vehicleId,
  p_work_type:String(payload.task).trim(),p_workshop:String(payload.workshop||'Unassigned').trim(),
  p_scheduled_at:payload.scheduledAt||null,p_source_dvir_id:payload.sourceDvirId||null,
 });
 return fail({data,error});
}
export async function updateAuthenticatedWorkOrder(client,{
 orderId,nextStatus,notes='',
}={}) {
 requireApi(client);
 if(!orderId||!ORDER_STATUS.includes(nextStatus))throw new Error('Invalid work order transition');
 const {data,error}=await client.rpc('at_update_service_work_order',{
  p_order_id:orderId,p_next_status:nextStatus,p_completion_notes:String(notes).trim(),
 });
 return fail({data,error});
}
export async function reviewAuthenticatedDvir(client,{
 reportId,nextStatus,notes='',
}={}) {
 requireApi(client);
 if(!reportId||!DVIR_STATUS.includes(nextStatus)||String(notes).trim().length<6)
   throw new Error('Select a valid report status and enter at least six characters of review notes.');
 const {data,error}=await client.rpc('at_review_vehicle_dvir',{
  p_report_id:reportId,p_next_status:nextStatus,p_review_notes:String(notes).trim(),
 });
 return fail({data,error});
}
/** Phase 10: read-only, RLS-scoped snapshot. Never assume missing RPC = clear. */
export async function loadDispatchSafetySnapshot(client,{organizationId}={}) {
 if(!client||!organizationId)throw new Error('Fleet safety status is unavailable.');
 const {data,error}=await client.rpc('at_dispatch_vehicle_safety_status',{
  p_organization_id:organizationId,
 });
 if(error)throw new Error(error.message||'Fleet safety screening failed.');
 if(!Array.isArray(data))throw new Error('Fleet safety response is incomplete.');
 return data;
}
export function serviceOrderSummary(orders=[]) {
 return {open:orders.filter(x=>['scheduled','in_service'].includes(x.status)).length,
  completed:orders.filter(x=>x.status==='completed').length,
  awaiting:orders.filter(x=>x.status==='scheduled').length};
}
export function dvirSummary(reports=[]) {
 return {total:reports.length,unreviewed:reports.filter(x=>x.status==='submitted').length,
   safetyOpen:reports.filter(x=>x.severity==='out-of-service'&&x.status!=='closed').length};
}
