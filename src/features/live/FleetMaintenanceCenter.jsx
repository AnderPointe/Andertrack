import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,ClipboardCheck,Clock3,Database,FileText,
 RefreshCw,ShieldCheck,Truck,Wrench} from 'lucide-react';
import {supabase} from '../../lib/supabase.js';
import {loadSafetyRecords,createAuthenticatedWorkOrder,updateAuthenticatedWorkOrder,
 reviewAuthenticatedDvir,dvirSummary,serviceOrderSummary} from '../../lib/fleet-maintenance-api.js';
import './fleet-maintenance.css';

const pretty=str=>String(str||'').replaceAll('_',' ').replaceAll('-',' ');
const dateString=str=>str?new Date(str).toLocaleString():'Not scheduled';
export default function FleetMaintenanceCenter({
 organizationId='',role='',currentUserId='',vehicles=[],isDemo=false,compact=false,
}){
 const planner=role==='admin'||role==='dispatcher';
 const [data,setData]=useState({configured:false,reports:[],orders:[],error:''});
 const requestVersion=useRef(0);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [vehicleId,setVehicleId]=useState(''),[task,setTask]=useState('');
 const [workshop,setWorkshop]=useState('Unassigned'),[scheduledAt,setScheduledAt]=useState('');
 const [sourceDvirId,setSourceDvirId]=useState('');
 const [workNotes,setWorkNotes]=useState({}),[reviewNotes,setReviewNotes]=useState({});
 const unit=vehicleId||vehicles[0]?.id||'';
 const activeVehicle=vehicles.find(v=>v.id===unit)||null;
 const unitLookup=useMemo(()=>new Map(vehicles.map(v=>[v.id,v.unit_number||v.id])),
   [vehicles]);
 const refresh=useCallback(async()=>{
  const version=++requestVersion.current;
  if(isDemo||!organizationId||!currentUserId)return;
  setLoading(true);
  const fresh=await loadSafetyRecords(supabase,{
   organizationId,driverOnly:!planner,currentUserId,
  });
  if(version!==requestVersion.current)return;
  setData(fresh);setLoading(false);
 },[organizationId,currentUserId,isDemo,planner]);
 useEffect(()=>{setData({configured:false,reports:[],orders:[],error:''});
   setError('');setNotice('');refresh();
   return ()=>{requestVersion.current++;};
 },[refresh]);
 const orders=data.orders||[],reports=data.reports||[];
 const counts=dvirSummary(reports),workCounts=serviceOrderSummary(orders);
 async function run(fn,success){
  setBusy(true);setError('');setNotice('');
  try{await fn();setNotice(success);await refresh();}
  catch(ex){setError(ex?.message||'Unable to save the requested change.');}
  finally{setBusy(false);}
 }
 async function create(event){
  event.preventDefault();if(!planner||!data.configured)return;
  const iso=scheduledAt?new Date(scheduledAt).toISOString():null;
  await run(()=>createAuthenticatedWorkOrder(supabase,{
   organizationId,vehicleId:unit,task,workshop,scheduledAt:iso,sourceDvirId,
  }), 'Work order recorded with a server timestamp and audit entry.');
  setTask('');setSourceDvirId('');
 }
 function nextService(order,newStatus){
  const notes=(workNotes[order.id]||'').trim();
  if(newStatus==='completed'&&notes.length<6){
   setError('Enter a completion explanation (at least 6 characters) before completing an order.');
   return;
  }
  run(()=>updateAuthenticatedWorkOrder(supabase,{
    orderId:order.id,nextStatus:newStatus,notes,
  }), 'Work order status updated and audit event recorded.');
 }
 function reviewReport(report,newStatus){
  const notes=(reviewNotes[report.id]||'').trim();
  if(notes.length<6){setError('A review note of at least six characters is required.');return;}
  run(()=>reviewAuthenticatedDvir(supabase,{
    reportId:report.id,nextStatus:newStatus,notes,
  }), 'DVIR reviewed with authenticated dispatcher attribution.');
 }
 if(isDemo)return <div className="at-maint-panel"><ShieldCheck size={21}/>
   <strong>Real fleet-safety records are disabled in sample mode.</strong>
   <p>Use a signed-in organization account after the reviewed migration has been approved.</p></div>;
 if(!organizationId||!currentUserId)return <div className="at-maint-panel">Sign in to access fleet maintenance records.</div>;
 return <section className={'at-maint '+(compact?'at-maint-compact':'')} aria-label="Authenticated fleet maintenance center">
  <div className="at-maint-head"><div><span>AUTHENTICATED OPERATIONS / AUDITABLE RECORDS</span>
    <h3><Wrench size={19}/> DVIR & Maintenance Work Orders</h3>
    <p>Driver-reported defects, dispatcher reviews, work orders, and maintenance status.</p></div>
    <button type="button" onClick={refresh} disabled={loading||busy} className="at-maint-refresh">
      <RefreshCw size={15}/>{loading?'Loading':'Refresh'}</button>
  </div>
  {loading&&<p className="at-maint-wait">Loading organization-scoped records…</p>}
  {!data.configured?<div className="at-maint-unavailable"><Database size={24}/>
    <strong>Persistent fleet-safety database not enabled</strong>
    <p>{data.error||'The approved safety and work-order migration has not been applied.'}</p>
    <small>Current demo planner and exportable DVIR drafts remain available. No records have been submitted.</small>
  </div>:<>
  <div className="at-maint-stats">
    <div><ClipboardCheck size={18}/><strong>{counts.total}</strong><span>{planner?'All visible defect reports':'My defect reports'}</span></div>
    <div><AlertTriangle size={18}/><strong>{counts.safetyOpen}</strong><span>Open severe defects</span></div>
    <div><Wrench size={18}/><strong>{workCounts.open}</strong><span>Open work orders</span></div>
    <div><CheckCircle2 size={18}/><strong>{workCounts.completed}</strong><span>Completed work orders</span></div>
  </div>
  {planner&&<form className="at-maint-create" onSubmit={create}>
    <h4>Create a real service work order</h4>
    <div className="at-maint-create-grid">
      <label>Fleet unit <select required value={unit} onChange={e=>{setVehicleId(e.target.value);setSourceDvirId('');}}>
        {!vehicles.length&&<option value="">No equipment available</option>}
        {vehicles.map(v=><option value={v.id} key={v.id}>{v.unit_number||v.id}</option>)}
      </select></label>
      <label>Task <input value={task} maxLength={160} minLength={3} required
        onChange={e=>setTask(e.target.value)} placeholder="e.g. Inspect brake caliper"/></label>
      <label>Workshop <input maxLength={120} value={workshop}
        onChange={e=>setWorkshop(e.target.value)}/></label>
      <label>Scheduled date & time <input type="datetime-local" value={scheduledAt}
        onChange={e=>setScheduledAt(e.target.value)}/></label>
      <label>Link open driver defect (optional)
        <select value={sourceDvirId} onChange={e=>setSourceDvirId(e.target.value)}>
        <option value="">No linked DVIR</option>
        {reports.filter(r=>r.vehicle_id===unit&&r.status!=='closed').map(r=>
          <option key={r.id} value={r.id}>{pretty(r.defect_type)} · {pretty(r.severity)}</option>)}
        </select></label>
    </div>
    <button type="submit" className="at-maint-primary" disabled={busy||!unit||task.trim().length<3}>
      <Wrench size={15}/>{busy?'Saving…':'Create work order'}</button>
    <small>Only organization administrators and dispatchers may create or update work orders.</small>
  </form>}
  <div className="at-maint-columns">
   <div className="at-maint-list"><h4><ClipboardCheck size={17}/> Driver defect reports</h4>
   {!reports.length&&<p>No DVIR defect reports recorded in this accessible organization scope.</p>}
   {reports.map(r=><article key={r.id}>
     <header><strong>{unitLookup.get(r.vehicle_id)||'Vehicle'} · {r.defect_type}</strong>
       <span className={r.severity==='out-of-service'?'critical':''}>{pretty(r.status)}</span></header>
     <p>{r.notes||'No additional driver description'}</p>
     <small>{pretty(r.severity)} · {dateString(r.created_at)}</small>
     {r.review_notes&&<div className="at-maint-history"><b>Dispatcher review:</b> {r.review_notes}</div>}
     {planner&&r.status!=='closed'&&<>
        <label>Review justification<textarea rows={2} maxLength={1500}
          placeholder="Document review and next steps"
          value={reviewNotes[r.id]||''} onChange={e=>setReviewNotes(p=>({...p,[r.id]:e.target.value}))}/></label>
        <div className="at-maint-actions">
         {r.status==='submitted'&&<button disabled={busy} onClick={()=>reviewReport(r,'acknowledged')}>
           Acknowledge</button>}
         {['submitted','acknowledged'].includes(r.status)&&<button disabled={busy}
           onClick={()=>reviewReport(r,'repair_required')}>Repair required</button>}
         {['acknowledged','repair_required'].includes(r.status)&&<button disabled={busy}
           onClick={()=>reviewReport(r,'closed')}>Administrative close</button>}
        </div>
       </>}
    </article>)}</div>
   <div className="at-maint-list"><h4><Wrench size={17}/> Maintenance work orders</h4>
    {!orders.length&&<p>No work orders have been recorded yet.</p>}
    {orders.map(o=><article key={o.id}>
       <header><strong>{unitLookup.get(o.vehicle_id)||'Vehicle'} · {o.work_type}</strong>
         <span>{pretty(o.status)}</span></header>
       <p>{o.workshop} · {dateString(o.scheduled_at)}</p>
       {o.source_dvir_id&&<small><ShieldCheck size={12}/> Linked to a reported vehicle defect</small>}
       {o.completion_notes&&<div className="at-maint-history">
         <b>Recorded completion:</b> {o.completion_notes}</div>}
       {planner&&['scheduled','in_service'].includes(o.status)&&<>
        <label>Completion / service notes<textarea rows={2} maxLength={1500}
          placeholder="Required for completion; identify repairs and verification"
          value={workNotes[o.id]||''}
          onChange={e=>setWorkNotes(p=>({...p,[o.id]:e.target.value}))}/></label>
        <div className="at-maint-actions">
         {o.status==='scheduled'&&<button disabled={busy} onClick={()=>nextService(o,'in_service')}>Start service</button>}
         {o.status==='in_service'&&<button disabled={busy} onClick={()=>nextService(o,'completed')}>Complete service</button>}
         <button disabled={busy} onClick={()=>nextService(o,'cancelled')}>Cancel</button>
        </div>
       </>}
    </article>)}</div>
  </div>
  <p className="at-maint-warning"><ShieldCheck size={15}/>
    Recorded report status and work-order completion are administrative records—not certified DVIR signatures,
    qualified mechanic repair certification, or automatic vehicle return-to-service authorization.</p>
  </>}
  {error&&<p className="at-maint-error" role="alert">{error}</p>}
  {notice&&<p className="at-maint-success" role="status">{notice}</p>}
 </section>;
}
