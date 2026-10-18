/**
 * Phase 10 — READ-ONLY AUTHENTICATED STAGING QA.
 *
 * Uses real Supabase Auth password sign-ins for dedicated nonproduction users.
 * Does not submit DVIRs, offers, service orders, assignments, or admin writes.
 * Refuses any project other than Andertrack Staging.
 *
 * Run locally with env vars described in docs/PHASE_10_AUTHENTICATED_QA_RUNBOOK.md.
 * Credentials must NEVER be committed or printed.
 */
import {createClient} from '@supabase/supabase-js';

const env=process.env;
const STAGING_HOST='ofyfausfhinwgrfmapgc.supabase.co';
const required=[
 'P10_STAGING_URL','P10_STAGING_PUBLISHABLE_KEY',
 'P10_ORG_A','P10_ORG_B',
 'P10_DISPATCHER_A_EMAIL','P10_DISPATCHER_A_PASSWORD',
 'P10_DRIVER_A_EMAIL','P10_DRIVER_A_PASSWORD',
 'P10_DISPATCHER_B_EMAIL','P10_DISPATCHER_B_PASSWORD',
 'P10_OOS_VEHICLE_ID','P10_DRIVER_A_DVIR_ID','P10_OTHER_DRIVER_DVIR_ID',
];
const missing=required.filter(k=>!env[k]?.trim());
if(missing.length) {
 console.error('NOT RUN: staging prerequisites missing: '+missing.join(', '));
 process.exitCode=2;
} else {
 let url;
 try {url=new URL(env.P10_STAGING_URL);} catch {console.error('NOT RUN: invalid staging URL');process.exitCode=2;}
 if(url&&(url.protocol!=='https:'||url.hostname!==STAGING_HOST||url.pathname!=='/'||url.search||url.hash)) {
  console.error('NOT RUN: refusing any URL other than the known Andertrack Staging Supabase origin.');
  process.exitCode=2;
 }
 if(url&&env.P10_ORG_A===env.P10_ORG_B) {
  console.error('NOT RUN: staging organizations must be distinct.');
  process.exitCode=2;
 }
 if(url&&!process.exitCode)await run();
}

async function run(){
 const url=env.P10_STAGING_URL;
 const clients=[];
 let passed=0;
 function verify(condition,label) {
  if(!condition)throw Error('FAILED: '+label);
  passed++;
  console.log('PASS: '+label);
 }
 function client(){
  const c=createClient(url,env.P10_STAGING_PUBLISHABLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
   global:{headers:{'X-Andertrack-QA':'phase10-auth-readonly'}},
  });
  clients.push(c);return c;
 }
 async function signIn(c,email,password,roleLabel){
  const {data,error}=await c.auth.signInWithPassword({email,password});
  verify(!error&&!!data?.session?.user?.id,roleLabel+' received a real Auth session');
  const {data:identity,error:getError}=await c.auth.getUser();
  verify(!getError&&identity?.user?.id===data.session.user.id,
   roleLabel+' Auth token validates against Supabase');
  return identity.user.id;
 }
 async function query(c,table,orgId){
  const {data,error}=await c.from(table).select('id,organization_id,vehicle_id,driver_user_id,status,severity')
   .eq('organization_id',orgId).limit(1000);
  verify(!error,table+' RLS read succeeds');
  return data||[];
 }
 async function membership(c,orgId,userId,role){
  const {data,error}=await c.from('at_organization_members').select('organization_id,user_id,role')
   .eq('organization_id',orgId).eq('user_id',userId).maybeSingle();
  verify(!error&&data?.role===role,role+' membership is server-visible in requested organization');
 }
 async function snapshot(c,orgId) {
  return c.rpc('at_dispatch_vehicle_safety_status',{p_organization_id:orgId});
 }

 try {
  const dispatcherA=client(), driverA=client(), dispatcherB=client(), anon=client();
  const dispatchAId=await signIn(dispatcherA,env.P10_DISPATCHER_A_EMAIL,
   env.P10_DISPATCHER_A_PASSWORD,'Dispatcher A');
  const driverAId=await signIn(driverA,env.P10_DRIVER_A_EMAIL,
   env.P10_DRIVER_A_PASSWORD,'Driver A');
  const dispatchBId=await signIn(dispatcherB,env.P10_DISPATCHER_B_EMAIL,
   env.P10_DISPATCHER_B_PASSWORD,'Dispatcher B');

  await membership(dispatcherA,env.P10_ORG_A,dispatchAId,'dispatcher');
  await membership(driverA,env.P10_ORG_A,driverAId,'driver');
  await membership(dispatcherB,env.P10_ORG_B,dispatchBId,'dispatcher');

  const a=await snapshot(dispatcherA,env.P10_ORG_A);
  verify(!a.error&&Array.isArray(a.data)&&a.data.length>0,
   'A planner reads nonempty own-organization safety snapshot');
  const oos=a.data?.find(v=>v.vehicle_id===env.P10_OOS_VEHICLE_ID);
  verify(oos&&Number(oos.open_out_of_service)>0,
   'staging known OOS vehicle is flagged by planner RPC');

  const foreign=await snapshot(dispatcherA,env.P10_ORG_B);
  verify(!!foreign.error,'dispatcher A cannot run planner snapshot for organization B');
  const other=await snapshot(dispatcherB,env.P10_ORG_A);
  verify(!!other.error,'dispatcher B cannot run planner snapshot for organization A');
  const ownB=await snapshot(dispatcherB,env.P10_ORG_B);
  verify(!ownB.error&&Array.isArray(ownB.data),
   'dispatcher B can access own organization safety snapshot');

  const driverRpc=await snapshot(driverA,env.P10_ORG_A);
  verify(!!driverRpc.error,'driver is denied planner-only safety RPC');
  const anonRpc=await snapshot(anon,env.P10_ORG_A);
  verify(!!anonRpc.error,'anonymous caller is denied safety RPC');

  const dispatcherReports=await query(dispatcherA,'at_vehicle_dvir_reports',env.P10_ORG_A);
  verify(dispatcherReports.some(x=>x.id===env.P10_DRIVER_A_DVIR_ID)&&
   dispatcherReports.some(x=>x.id===env.P10_OTHER_DRIVER_DVIR_ID),
   'dispatcher sees both explicit staging DVIR fixtures');
  const driverReports=await query(driverA,'at_vehicle_dvir_reports',env.P10_ORG_A);
  verify(driverReports.some(x=>x.id===env.P10_DRIVER_A_DVIR_ID),
   'driver sees their own explicit DVIR fixture');
  verify(driverReports.every(x=>x.driver_user_id===driverAId)&&
   !driverReports.some(x=>x.id===env.P10_OTHER_DRIVER_DVIR_ID),
   'driver cannot see another driver DVIR in same organization');

  const driverForeign=await query(driverA,'at_vehicle_dvir_reports',env.P10_ORG_B);
  verify(driverForeign.length===0,'driver sees no foreign-organization DVIRs');
  const dispatcherForeign=await query(dispatcherA,'at_vehicle_dvir_reports',env.P10_ORG_B);
  verify(dispatcherForeign.length===0,'dispatcher sees no foreign-organization DVIRs');
  const ownBReports=await query(dispatcherB,'at_vehicle_dvir_reports',env.P10_ORG_B);
  verify(Array.isArray(ownBReports),'dispatcher B authenticated read succeeds');

  console.log('PASS: '+passed+' authenticated staging assertions; no operational writes performed.');
 }catch(_error){
  // Deliberately suppress potentially sensitive Auth/network exception contents.
  console.error('FAIL: authenticated staging QA stopped. Inspect test labels and staging identities; do not log tokens or passwords.');
  process.exitCode=1;
 }finally {
  for(const c of clients) { try{await c.auth.signOut();}catch {/*No persistent session*/} }
 }
}
