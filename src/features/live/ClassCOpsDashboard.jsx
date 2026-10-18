import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
 Activity,AlertTriangle,ArrowRight,BatteryCharging,Bell,CalendarDays,CarFront,
 CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,ClipboardCheck,Clock3,MapPinned,
 DollarSign,Download,Fuel,Gauge,LayoutDashboard,Menu,Plus,Search,Settings2,
 ShieldAlert,ShieldCheck,SlidersHorizontal,Sparkles,Stethoscope,Truck,
 Wrench,X,Play,Pause,RotateCcw,
} from 'lucide-react';
import Vehicle3D from './Vehicle3D.jsx';
import ClassCMapPanel from './ClassCMapPanel.jsx';
import FleetMaintenanceCenter from './FleetMaintenanceCenter.jsx';
import {supabase} from '../../lib/supabase.js';
import {loadSafetyRecords,submitAuthenticatedDvir,validateDvirSubmission} from '../../lib/fleet-maintenance-api.js';
import {
  NORTHVALE_REFERENCE_VEHICLES,NORTHVALE_REFERENCE_ALERTS,
  NORTHVALE_REFERENCE_SCHEDULE,NORTHVALE_REFERENCE_FORECAST,northvaleHotspots,
} from '../../lib/northvale-reference-demo.js';
import {
 NORTHVALE_TABS,NORTHVALE_DEMO,NORTHVALE_DEMO_VEHICLES,
 NORTHVALE_DEMO_SCHEDULE,NORTHVALE_DEMO_ALERTS,NORTHVALE_DEMO_WEEK,
 NORTHVALE_DEMO_COSTS,classCEligibility,classCOpsRecords,
 classCDriverAssignment,classCShiftElapsed,classCStops,classCServiceDraft,filterClassCFleet,
 classCDvirDraft,classCCostBreakdown,
} from '../../lib/class-c-operations.js';
import {VEHICLE_FORMS,vehicleDisplay} from '../../lib/vehicle-3d.js';
import './class-c-operations.css';

const money=amount=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',
 maximumFractionDigits:0}).format(Number(amount)||0);
const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+
  String(minutes%60).padStart(2,'0');
const DEMO_SHIFT={startOffsetMinutes:235,stops:8,earnings:185,tips:32};

function Metric({icon:Icon,title,value,foot,tone=''}){
 return <div className={'at-nv-metric '+tone}><div className="at-nv-metric-top"><span>{title}</span><Icon size={19}/></div>
 <strong>{value}</strong><small>{foot}</small></div>;
}
function SectionTitle({title,sub,action}){return <div className="at-nv-section-title"><div>
 <h3>{title}</h3>{sub&&<p>{sub}</p>}</div>{action}</div>;}
function Unconnected({title,detail,icon:Icon=ShieldAlert}){
 return <div className="at-nv-unconnected"><Icon size={28}/><strong>{title}</strong><p>{detail}</p></div>;
}
function Status({label='Unknown',tone='good'}){return <span className={'at-nv-status '+tone}>
 <i/>{label}</span>;}
function FleetGauge({score=null}) {
 const valid=typeof score==='number';
 const pct=valid?Math.max(0,Math.min(score,100)):0;
 return <div className="at-nv-gauge" role="img" aria-label={valid?
   'Illustrative fleet health score '+score+' of 100':'No connected fleet mechanical health scores'}>
 <svg viewBox="0 0 300 175" aria-hidden="true">
   {Array.from({length:31},(_,i)=>{const rad=(180-i*6)*Math.PI/180;
     const x1=150+112*Math.cos(rad),y1=143-112*Math.sin(rad);
     const x2=150+126*Math.cos(rad),y2=143-126*Math.sin(rad);
     return <line key={i} x1={x1} x2={x2} y1={y1} y2={y2}
       stroke={valid&&i<=pct/100*30?(i<12?'#f15b51':i<20?'#f4b53d':'#24a77a'):'#dfe7e4'}
       strokeLinecap="round" strokeWidth="7"/>;})}
 </svg><div className="at-nv-gauge-label"><strong>{valid?score:'—'}<small>{valid?'/100':''}</small></strong>
 <span>{valid?'DEMO HEALTH SCORE':'NO VERIFIED HEALTH FEED'}</span></div></div>;
}
function MonthlyChart({sample}) {
 const [month,setMonth]=useState(5);
 if(!sample)return <Unconnected icon={DollarSign} title="No service-cost ledger connected"
   detail="Fleet maintenance actuals and forward forecasts require verified service invoices and budgets."/>;
 const selected=NORTHVALE_REFERENCE_FORECAST[month];
 const max=7500;
 const points=kind=>NORTHVALE_REFERENCE_FORECAST.map((m,i)=>
   [38+i*61,179-(m[kind]/max)*139]);
 const path=kind=>points(kind).map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
 return <div className="at-nv-forecast-panel">
  <div className="at-nv-forecast-inspector" aria-live="polite">
   <strong>{selected.month} 2026</strong>
   <span>Actual: <b>{money(selected.actual)}</b></span>
   <span>Forecast: <b>{money(selected.forecast)}</b></span>
   <small>Synthetic financial series · interactive sample</small>
  </div>
  <svg viewBox="0 0 760 220" className="at-nv-cost-chart"
   aria-label="Synthetic actual versus forecasted monthly maintenance costs January through December 2026">
  {Array.from({length:4},(_,i)=><line key={i} x1="38" x2="726" y1={48+i*44}
    y2={48+i*44} stroke="#dce6e3" strokeDasharray="4 4"/>)}
  <path d={path('forecast')} fill="none" stroke="#a3c7bb" strokeDasharray="7 5"
    strokeWidth="3" strokeLinecap="round"/>
  <path d={path('actual')+' L709 179 L38 179 Z'} fill="#c9f6e7" opacity=".55"/>
  <path d={path('actual')} fill="none" stroke="#0b9469" strokeWidth="4" strokeLinecap="round"/>
  {NORTHVALE_REFERENCE_FORECAST.map((m,i)=>{
   const [x,y]=points('actual')[i];
   return <g key={m.month} role="button" tabIndex={0}
      aria-label={m.month+' actual '+money(m.actual)+' forecast '+money(m.forecast)}
      onMouseEnter={()=>setMonth(i)} onFocus={()=>setMonth(i)}
      onClick={()=>setMonth(i)}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setMonth(i);}}}>
      {i===month&&<line x1={x} x2={x} y1="30" y2="180" stroke="#94c9af" strokeDasharray="3 4"/>}
      <circle cx={x} cy={y} r={i===month?7:4} stroke="#0b9469"
        strokeWidth={i===month?3:1} fill={i===month?'#ffffff':'#0b9469'}/>
      <text x={x} y="210" fontSize="12" textAnchor="middle"
        fontWeight={i===month?'bold':'normal'} fill={i===month?'#14724a':'#779188'}>{m.month}</text>
    </g>;
  })}
  </svg>
 </div>;
}

function Donut({series}) {
 const total=series.reduce((s,x)=>s+x.value,0);
 let acc=0;
 const gradient=series.map((x,i)=>{const start=acc;acc+=(x.value/Math.max(total,1))*100;
   return ['#0c9d74','#9fdbbd','#f6b751','#7da9bd'][i%4]+' '+start+'% '+acc+'%';}).join(', ');
 return <div className="at-nv-donut-wrap"><div className="at-nv-donut"
  role="img" aria-label={'Demo operating costs '+money(total)}
  style={{background:'conic-gradient('+gradient+')'}}><div><strong>{money(total)}</strong><small>DEMO TOTAL</small></div></div>
  <div className="at-nv-donut-legend">{series.map((s,i)=><div key={s.label}>
  <i style={{background:['#0c9d74','#9fdbbd','#f6b751','#7da9bd'][i%4]}}/>
  <span>{s.label}</span><strong>{money(s.value)}</strong></div>)}</div></div>;
}
function SubsystemInspector({sample,vehicle}) {
 const hotspots=sample?northvaleHotspots(vehicle?.unit_number):[];
 const [selectedId,setSelectedId]=useState('');
 useEffect(()=>setSelectedId(''),[vehicle?.id]);
 const selected=hotspots.find(x=>x.id===selectedId)||hotspots[0]||null;
 const systems=sample?(vehicle?.subsystems?
   Object.entries(vehicle.subsystems).map(([label,[score,unit]])=>({
     label,score,unit,tone:label==='Transmission'&&score<60?'alert':
       score<70?'watch':'good',
   })):NORTHVALE_DEMO.subsystems):[];
 return <div className="at-nv-analytics-inspector">
  <div className="at-nv-overhead" aria-label={sample?
      'Interactive fictional top-down vehicle diagnostic overview':'Vehicle diagram without connected diagnostic sensors'}>
   <div className="at-nv-top-car" aria-hidden="true"><div className="at-nv-windshield"/>
     <div className="at-nv-roof"/><div className="at-nv-hood"/>
     <span className="wheel front-left"/><span className="wheel front-right"/>
     <span className="wheel rear-left"/><span className="wheel rear-right"/>
   </div>
   {hotspots.map(h=><button type="button" key={h.id}
     className={'at-nv-hotspot-pin '+h.severity+(selected?.id===h.id?' selected':'')}
     style={{left:h.x+'%',top:h.y+'%'}} onClick={()=>setSelectedId(h.id)}
     aria-pressed={selected?.id===h.id} title={'Sample: '+h.label}
     aria-label={'Inspect simulated '+h.label}>!</button>)}
   <span className="at-nv-top-car-caption">{sample?'SAMPLE SYSTEM READINGS':'NO VEHICLE SENSOR LINK'}</span>
  </div>
  <div className="at-nv-subsystems">
   {sample&&<div className="at-nv-hotspot-reader" role="status">
     <strong>{vehicle?.unit_number||'Sample equipment'} · Diagnostic Hotspots</strong>
     {selected?<><span>{selected.label}</span><small>Illustrative {selected.severity} reading · not a verified repair ticket</small></>:
       <span>No sample hotspot flagged for this unit.</span>}
   </div>}
   {sample?systems.map(system=><div className="at-nv-system" key={system.label}>
     <div><span>{system.label}</span><strong>{system.score}{system.unit}</strong></div>
     <div className="at-nv-progress"><span className={system.tone}
       style={{width:Math.max(0,Math.min(100,system.label==='Fuel'?system.score*10:system.score))+'%'}}/></div></div>):
   <Unconnected title="Six vehicle subsystems not connected"
     detail="Engine, brakes, transmission, TPMS, battery, fuel economy and efficiency require vehicle telematics."
     icon={Stethoscope}/>}</div>
 </div>;
}

function ShiftBar({isDemo=false,role='',currentUserId='',records,vehicles,assignments,drivers,openDvir,demoUnit=''}) {
 const driver=role==='driver';
 const [expanded,setExpanded]=useState(true),[running,setRunning]=useState(false),
   [start,setStart]=useState(null),[base,setBase]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const interval=window.setInterval(()=>setNow(Date.now()),15000);
    return ()=>window.clearInterval(interval);},[]);
 // null is an explicit no-match result; empty/omitted keeps Driver Cockpit's sample fallback.
 const demoSelected=demoUnit===null?null:
   NORTHVALE_REFERENCE_VEHICLES.find(v=>v.unit_number===demoUnit)||
   NORTHVALE_REFERENCE_VEHICLES.find(v=>v.unit_number==='VAN-021')||NORTHVALE_DEMO_VEHICLES[1];
 const chosen=isDemo?{vehicle:demoSelected,assignment:{id:'nv-demo-load'}}:
   classCDriverAssignment({assignments,vehicles,currentUserId});
 const sampleOffset=isDemo?DEMO_SHIFT.startOffsetMinutes:0;
 const minutes=sampleOffset+base+(running?classCShiftElapsed(start,now):0);
 const stops=isDemo?(demoSelected?.demoStops?.join(' / ')||(demoSelected?DEMO_SHIFT.stops:'—')):classCStops(assignments,currentUserId).length;
 const eligibleDriver=isDemo||(driver&&drivers.some(d=>d.user_id===currentUserId&&
   d.license_class==='C'));
 if(!eligibleDriver)return null;
 const run=()=>{if(running){setBase(Math.max(0,minutes-sampleOffset));setRunning(false);setStart(null);}
   else{setStart(Date.now());setRunning(true);}};
 return <section className="at-nv-shift"><div className="at-nv-shift-head"><div><span>CLASS C LOCAL SHIFT</span>
  <strong>{isDemo?'Sample delivery operator':'My local driver shift'}</strong></div>
  <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
    {expanded?'Collapse':'Expand'} <ChevronDown size={15}/></button></div>
 {expanded&&<div className="at-nv-shift-metrics">
  <div><small>Assigned unit</small><strong>{chosen.vehicle?.unit_number||'Not assigned'}</strong>
    <span>{isDemo?(demoSelected?demoSelected.demoDriver+' · '+demoSelected.demoRoute:'No sample vehicle matches search'):chosen.vehicle?'Class C category · GVWR review':'No current Class C vehicle'}</span></div>
  <div><small>{isDemo?'Sample time':'Local session timer'}</small><strong>{clock(minutes)}</strong>
    <button type="button" onClick={run} className="at-nv-shift-timer">{running?<Pause size={12}/>:<Play size={12}/>}
      {running?'Pause':'Start'}</button></div>
  <div><small>Delivery stops</small><strong>{stops}</strong><span>
    {isDemo?'Sample stops':'Visible assigned Class C loads, not stop-level records'}</span></div>
  <div><small>Daily earnings + tips</small><strong>{isDemo?
    (demoSelected?money(demoSelected.demoPay??(DEMO_SHIFT.earnings+DEMO_SHIFT.tips)):'—'):'Not connected'}</strong>
    <span>{isDemo?'Fictional sample total · not actual pay':'Payroll and gratuity feed required'}</span></div>
  <button type="button" className="at-nv-dvir-button" disabled={!chosen.vehicle} onClick={()=>openDvir(chosen.vehicle?.unit_number||'')}>
    <ClipboardCheck size={19}/> Report DVIR defect</button></div>}
 <p className="at-nv-shift-foot">Local session timer is not a certified ELD or persistent timesheet.
  Driver vehicle eligibility and CDL exemptions depend on actual GVWR, use and applicable rules.</p>
 </section>;
}
function ServiceModal({vehicles,create,cancel,isDemo}) {
 const [unit,setUnit]=useState(vehicles[0]?.unit_number||'');
 const [job,setJob]=useState(''),[day,setDay]=useState(0),[time,setTime]=useState('08:00'),[bay,setBay]=useState('Bay 01');
 const draft=classCServiceDraft({unit,job,day,time,bay});
 return <div className="at-nv-modal" onMouseDown={e=>{if(e.target===e.currentTarget)cancel();}}>
 <form className="at-nv-modal-card" role="dialog" aria-modal="true" aria-label="New service appointment"
 onSubmit={e=>{e.preventDefault();if(draft.valid)create(draft);}}>
 <div className="at-nv-section-title"><h3>New service appointment · local draft</h3>
 <button type="button" onClick={cancel} aria-label="Close service modal"><X size={18}/></button></div>
 <p>Build a sample weekly maintenance appointment. It will appear in this view but is not sent to workshop systems.</p>
 <label>Vehicle <select value={unit} onChange={e=>setUnit(e.target.value)}>
  {vehicles.map(v=><option key={v.id} value={v.unit_number}>{v.unit_number}</option>)}</select></label>
 <label>Service task <input required maxLength={140} value={job} onChange={e=>setJob(e.target.value)}
   placeholder="e.g. Front brake inspection"/></label>
 <div className="at-nv-modal-pair"><label>Day<select value={day} onChange={e=>setDay(Number(e.target.value))}>
  {NORTHVALE_DEMO_WEEK.map((d,i)=><option key={i} value={i}>{d}</option>)}</select></label>
 <label>Start time<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label></div>
 <label>Workshop / service bay <input value={bay} maxLength={60} onChange={e=>setBay(e.target.value)}/></label>
 <button disabled={!draft.valid} type="submit" className="at-nv-primary">Add local appointment <Plus size={15}/></button>
 </form></div>;
}
function DvirModal({unit='',close,driverId,isDemo,role='',organizationId='',
 assignmentId='',vehicleId=''}) {
 const [defect,setDefect]=useState(''),[severity,setSeverity]=useState('needs-review');
 const [note,setNote]=useState(''),[result,setResult]=useState('');
 const [attested,setAttested]=useState(false),[connected,setConnected]=useState(false);
 const [sending,setSending]=useState(false),[submitError,setSubmitError]=useState('');
 const draft=classCDvirDraft({unit,driverId,defect,severity,note});
 const canSubmit=!isDemo&&role==='driver'&&Boolean(organizationId&&vehicleId&&assignmentId);
 useEffect(()=>{
   let active=true;
   if(!canSubmit){setConnected(false);return undefined;}
   loadSafetyRecords(supabase,{
     organizationId,driverOnly:true,currentUserId:driverId,
   }).then(status=>{if(active)setConnected(status.configured);});
   return ()=>{active=false;};
 },[canSubmit,organizationId,driverId]);
 const download=()=>{
  const body=JSON.stringify({...draft,createdAt:new Date().toISOString()},null,2);
  const blob=new Blob([body],{type:'application/json'});
  const uri=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=uri;a.download='andertrack-dvir-DRAFT-'+Date.now()+'.json';a.click();
  URL.revokeObjectURL(uri);setResult('Draft exported to this device. Not submitted to dispatch or maintenance.');
 };
 async function submitToFleet(){
   if(!canSubmit||!connected||!attested)return;
   const payload={organizationId,vehicleId,assignmentId,
     defectType:defect,severity,notes:note,attested};
   const check=validateDvirSubmission(payload);
   if(!check.valid){setSubmitError(check.error);return;}
   setSending(true);setSubmitError('');setResult('');
   try{
     const createdId=await submitAuthenticatedDvir(supabase,payload);
     setResult('Defect report saved by the server and awaiting dispatcher review. Reference: '+createdId+
       '. Notify dispatch directly for urgent safety issues.');
   }catch(error){setSubmitError(error?.message||'Fleet submission failed. No record was confirmed.');}
   finally{setSending(false);}
 }
 return <div className="at-nv-modal" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
 <form className="at-nv-modal-card" role="dialog" aria-modal="true" aria-label="DVIR defect report"
 onSubmit={e=>{e.preventDefault();if(draft.valid)download();}}>
 <div className="at-nv-section-title"><h3>DVIR defect reporting</h3>
 <button type="button" onClick={close} aria-label="Close defect report"><X size={18}/></button></div>
 <div className="at-nv-alert"><ShieldAlert size={16}/>
  {canSubmit&&connected?
   'Authenticated defect submission is available; submission does not certify roadworthiness or release equipment.':
   'Export a local draft only. Fleet submission is unavailable until the reviewed safety backend is enabled.'}
  Report safety-critical defects through existing company procedures immediately.</div>
 <label>Vehicle unit<input readOnly value={unit||'No current equipment'}/></label>
 <label>Defect category <select required value={defect} onChange={e=>setDefect(e.target.value)}>
  <option value="">Choose a defect</option><option value="Brake system">Brake system</option>
  <option value="Tires and wheels">Tires and wheels</option>
  <option value="Lights and signals">Lights and signals</option>
  <option value="Steering">Steering</option><option value="Engine or transmission">Engine or transmission</option>
  <option value="Other safety issue">Other safety issue</option></select></label>
 <label>Driver assessment <select value={severity} onChange={e=>setSeverity(e.target.value)}>
  <option value="needs-review">Requires maintenance review</option>
  <option value="out-of-service">Do not operate until inspected</option></select></label>
 <label>Defect description<textarea rows={3} maxLength={500} value={note}
  onChange={e=>setNote(e.target.value)} placeholder="Describe location, symptom, and severity"/></label>
 <button disabled={!draft.valid} className="at-nv-primary" type="submit">
   <Download size={16}/> Export unsubmitted DVIR draft</button>
 {canSubmit&&connected&&<><label className="at-nv-dvir-confirm">
    <input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>
    I personally observed this condition on my assigned vehicle. This is a defect report,
    not a certified DVIR signature or inspection clearance.</label>
   <button type="button" className="at-nv-primary" onClick={submitToFleet}
     disabled={!draft.valid||!attested||sending}>
     <ClipboardCheck size={16}/>{sending?'Submitting…':'Submit defect to fleet database'}</button></>}
 {submitError&&<p role="alert" className="at-nv-alert">{submitError}</p>}
 {result&&<p className="at-nv-confirm" role="status">{result}</p>}
 </form></div>;
}

function DashboardTab({vehicles,assignments,counts,isDemo,onService,onDetails,
  selectedUnitId='',onSelectVehicle=()=>{},schedule=[]}) {
 const displayed=vehicles;
 const selected=displayed.find(v=>v.id===selectedUnitId)||displayed[0]||null;
 const stats=isDemo?NORTHVALE_DEMO.summary:
  {total:counts.total,active:counts.active,maintenance:null,criticalAlerts:null};
 return <div className="at-nv-tab-content">
 <div className="at-nv-metrics">
  <Metric icon={Truck} title="Total Class C vehicles" value={stats.total} foot={isDemo?'Sample fleet size':'Accessible equipment inventory'}/>
  <Metric icon={CheckCircle2} title="Active today" value={stats.active} foot={isDemo?'Sample reporting':'Active assignments in loaded records'} tone="green"/>
  <Metric icon={Wrench} title="In maintenance" value={stats.maintenance??'—'} foot={isDemo?'Sample service count':'Maintenance data not connected'} tone="amber"/>
  <Metric icon={AlertTriangle} title="Critical alerts" value={stats.criticalAlerts??'—'}
   foot={isDemo?'Sample fault counter':'Diagnostics stream not connected'} tone="red"/>
 </div>
 <div className="at-nv-dashboard-split">
  <section className="at-nv-panel at-nv-showcase"><SectionTitle title="Class C Vehicle Showcase"
   sub="Select a unit and rotate its generic 3D body preview"
   action={<span className="at-nv-chip">{isDemo?'NORTHVALE SAMPLE':'LIVE INVENTORY'}</span>}/>
   {selected?<><div className="at-nv-vehicle-selector">
     {displayed.map((v,i)=><button key={v.id} className={selected.id===v.id?'selected':''} onClick={()=>onSelectVehicle(v) }
       aria-pressed={selected.id===v.id}>{v.unit_number}<small>{v.model||v.vehicle_type}</small></button>)}</div>
     <Vehicle3D key={selected.id} vehicle={selected} compact isDemo={isDemo}
       title={vehicleDisplay(selected).title+' · 3D model concept'}/>
     <div className="at-nv-quick-actions">
       <button onClick={()=>onDetails(selected)}><ArrowRight size={14}/> View details</button>
       <button onClick={()=>onDetails(selected,'vehicles')}><Activity size={14}/> Health report</button>
       <button onClick={()=>onDetails(selected,'documents')}><ClipboardCheck size={14}/> Documents</button>
       <button onClick={onService}><Wrench size={14}/> Work order draft</button>
     </div></>:<Unconnected icon={Truck} title="No Class C inventory"
      detail="Eligible vehicle classes and their assignments will appear when added to the fleet."/>}
  </section>
  <section className="at-nv-panel"><SectionTitle title="Upcoming Schedule"
   sub="Weekly workshop plan" action={<button className="at-nv-link" onClick={onService}>Open service plan <ArrowRight size={14}/></button>}/>
   {isDemo?<div className="at-nv-schedule-list">{schedule.slice(0,4).map(x=><div key={x.id}>
    <div className="at-nv-date"><CalendarDays size={15}/><strong>{NORTHVALE_DEMO_WEEK[x.day]}</strong><small>{x.time}</small></div>
    <div><strong>{x.job}</strong><small>{x.unit} · {x.bay}</small></div>
    <Status label={x.state} tone={x.state==='Completed'?'good':'watch'}/></div>)}</div>:
    <Unconnected icon={CalendarDays} title="No connected maintenance schedule"
      detail="Create sample drafts using Service Plan. Actual workshop dates need an approved maintenance backend."/>}
  </section>
 </div>
 <div className="at-nv-dashboard-split">
  <section className="at-nv-panel"><SectionTitle title="Yearly Maintenance Cost Forecast"
   sub={isDemo?'Sample forecast · June 2026':'Service ledger integration required'}
   action={isDemo?<span className="at-nv-budget"><strong>$4,592</strong> actual · <strong>$5,100</strong> forecast</span>:null}/>
   <MonthlyChart sample={isDemo}/></section>
  <section className="at-nv-panel"><SectionTitle title="Quick Fleet Overview"
   sub="Equipment readiness and reporting"/>
   <div className="at-nv-overview-rows">
   {(isDemo?[
     ['Available today',115,'good'],['Requires service',15,'watch'],['Critical attention',28,'bad'],
   ]:[['Enabled units',vehicles.filter(v=>v.enabled).length,'good'],
     ['Disabled units',vehicles.filter(v=>!v.enabled).length,'watch'],
     ['Mechanical alerts','Not connected','bad']]).map(([name,value,tone])=><div key={name}>
       <span>{name}</span><strong>{value}</strong><Status label={tone==='good'?'Ready':tone==='watch'?'Review':'Attention'}
       tone={tone==='bad'?'danger':tone}/></div>)}</div>
   {isDemo&&<div className="at-nv-quick-fleet" aria-label="Six reference vehicles">
     {displayed.map(v=><button key={v.id} type="button"
       className={selected?.id===v.id?'selected':''}
       onClick={()=>{onSelectVehicle(v);onDetails(v,'vehicles');}}>
       <span className="at-nv-quick-fleet-unit"><Truck size={16}/><span>
         <strong>{v.model?.toUpperCase()||'VEHICLE'} · {v.unit_number}</strong>
         <small>{v.demoDriver||'Sample driver'} · {v.demoRoute||'Sample route'}</small>
       </span></span>
       <Status label={v.condition||'Sample'} tone={v.condition==='Active'?'good':
         v.condition==='Service'?'watch':'danger'}/>
     </button>)}
   </div>}
   <SectionTitle title="Fleet Condition" sub={isDemo?'Fictional subsystem averages':'Not connected to ELD/OBD/TPMS'}/>
   {isDemo?NORTHVALE_DEMO.subsystems.slice(0,4).map(s=><div key={s.label} className="at-nv-condition">
    <span>{s.label}</span><div className="at-nv-progress"><i style={{width:Math.min(s.score*10,100)+'%'}}/></div>
    <strong>{s.score}{s.unit}</strong></div>):
    <Unconnected icon={Gauge} title="Condition sensors unavailable"
      detail="Verified telematics required for engine, brakes, battery, tires and transmission."/>}
  </section>
 </div>
 </div>;
}

function VehiclesTab({vehicles,isDemo,alerts,focusId='',onSelectVehicle=()=>{},
 focusAlerts=false,onAlertFocusHandled=()=>{}}) {
 const [active,setActive]=useState(''),[query,setQuery]=useState('');
 const alertsRef=useRef(null);
 useEffect(()=>{
   if(!focusAlerts)return;
   alertsRef.current?.focus({preventScroll:true});
   alertsRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
   onAlertFocusHandled();
 },[focusAlerts,onAlertFocusHandled]);
 useEffect(()=>{if(focusId)setActive(focusId);},[focusId]);
 const filtered=vehicles.filter(v=>[v.make,v.model,v.unit_number,v.vehicle_type].join(' ')
   .toLowerCase().includes(query.toLowerCase()));
 const selected=filtered.find(v=>v.id===active)||filtered[0]||null;
 const h=NORTHVALE_DEMO.health;
 return <div className="at-nv-tab-content">
  <div className="at-nv-health-strip">{[
   ['Fleet active',isDemo?h.active+'%':'—','green'],['Service condition',isDemo?h.service+'%':'—','amber'],
   ['Critical status',isDemo?h.critical+'%':'—','red'],
  ].map(([label,value,tone])=><div key={label} className={tone}>
   <span>{label}</span><strong>{value}</strong>
   <small>{isDemo?'Sample comparison indicator':'No validated mechanical condition metrics'}</small></div>)}</div>
  <div className="at-nv-dashboard-split">
   <section className="at-nv-panel"><SectionTitle title="Fleet Health Center" sub={isDemo?'Sample gauge and counts':'Mechanical diagnostic connection status'}/>
     <FleetGauge score={isDemo?h.score:null}/>
     {isDemo?<div className="at-nv-health-categories">{[
       ['Critical',h.criticalUnits,'red'],['Needs attention',h.needsAttention,'amber'],['Healthy',h.healthy,'green'],
     ].map(([label,value,tone])=><div key={label} className={tone}><strong>{String(value).padStart(2,'0')}</strong><span>{label}</span></div>)}</div>:
      <p className="at-nv-muted">No vehicle health history, fault codes, service records or aggregated fleet condition score exists in the current data source.</p>}
   </section>
   <section className="at-nv-panel at-nv-alert-target" ref={alertsRef} tabIndex={-1} aria-label="Recent Alerts"><SectionTitle title="Recent Alerts" sub={isDemo?'Illustrative vehicle diagnostic feed':'Live diagnostic feed not connected'}/>
    {isDemo?<div className="at-nv-alert-list">{alerts.map(a=><div key={a.id}>
      <span className={'at-nv-severity '+a.severity}><AlertTriangle size={15}/></span>
      <div><strong>{a.title}</strong><small>{a.unit} · {a.source}</small></div>
      <Status label={a.severity} tone={a.severity==='critical'?'danger':'watch'}/></div>)}</div>:
      <Unconnected icon={AlertTriangle} title="Diagnostic alerts unavailable"
       detail="Connect an approved OBD/telematics provider or a verified service work-order database."/>}
   </section>
  </div>
  <section className="at-nv-panel"><SectionTitle title="Class C Vehicle Inventory"
   sub="Select a unit to review its recorded metadata and 3D preview"
   action={<label className="at-nv-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Search Class C equipment"/></label>}/>
    <div className="at-nv-vehicle-health-body">
      <div className="at-nv-vehicle-list">{filtered.map(v=><button key={v.id}
        className={selected?.id===v.id?'selected':''} onClick={()=>{setActive(v.id);onSelectVehicle(v);}}>
       <span><Truck size={18}/></span><div><strong>{v.unit_number}</strong><small>{vehicleDisplay(v).title}</small></div>
       {isDemo?<strong className="at-nv-sample-score">{v.score}/100</strong>:
         <span className="at-nv-unverified">Health unavailable</span>}</button>)}
       {!filtered.length&&<p>No vehicles match the search.</p>}</div>
      <div>{selected?<><Vehicle3D key={selected.id} vehicle={selected} compact
        isDemo={isDemo} title="Equipment 3D inspection"/><p className="at-nv-muted">
        <ShieldCheck size={14}/> {classCEligibility(selected).label}</p></>:
        <Unconnected title="Select a vehicle" detail="No eligible Class C equipment available."/ >}</div>
    </div>
   </section>
 </div>;
}
function ServiceTab({vehicles,isDemo,schedule,onOpen,onRemove}) {
 const s=NORTHVALE_DEMO.service;
 const stats=isDemo?[
  ['Scheduled today',s.today],['Due this week',s.week],['Under service',s.inService],
  ['Completed today',s.completed],['Overdue',s.overdue],
 ]:[
  ['Scheduled today','—'],['Due this week','—'],['Under service','—'],
  ['Completed today','—'],['Overdue','—']];
 return <div className="at-nv-tab-content">
  <div className="at-nv-service-stats">{stats.map(([label,value],i)=><div key={label}>
   <small>{label}</small><strong>{value}</strong><span>{isDemo?'Demo maintenance plan':'Service backend unconnected'}</span></div>)}</div>
  <section className="at-nv-panel"><SectionTitle title="Weekly Maintenance Timetable"
    sub={isDemo?'Mon 08 – Fri 12 · illustrative workshop allocations':'Local appointment drafts only · not scheduled with real technicians'}
    action={<button type="button" className="at-nv-primary" onClick={onOpen}><Plus size={16}/> New Service</button>}/>
    <div className="at-nv-timetable-wrap"><div className="at-nv-timetable">
      {NORTHVALE_DEMO_WEEK.map((day,index)=><div key={day} className="at-nv-timetable-day">
       <h4>{day}<small>Workshop calendar</small></h4>
       {schedule.filter(x=>x.day===index).sort((a,b)=>a.time.localeCompare(b.time)).map(x=>
        <article key={x.id}><span><Clock3 size={13}/>{x.time}</span><strong>{x.job}</strong>
        <small>{x.unit} · {x.bay}</small><Status label={x.state} tone={x.state==='Completed'?'good':'watch'}/>
        {String(x.id).startsWith('draft-')&&<button type="button"
          onClick={()=>onRemove(x.id)}>Remove local draft</button>}</article>)}
       {!schedule.some(x=>x.day===index)&&<div className="at-nv-day-empty">No appointments</div>}
      </div>)}
    </div></div>
    {!isDemo&&<p className="at-nv-muted"><ShieldAlert size={14}/>
      These entries are local-only planning drafts. Creating a live work order requires a database-backed maintenance workflow.</p>}
  </section>
 </div>;
}
function AnalyticsTab({isDemo,vehicles,counts,selectedUnitId='',onSelectVehicle=()=>{}}) {
 const h=NORTHVALE_DEMO;
 const selected=vehicles.find(v=>v.id===selectedUnitId)||vehicles[0]||null;
 return <div className="at-nv-tab-content">
  <div className="at-nv-dashboard-split">
   <section className="at-nv-panel"><SectionTitle title="Top-Down Hotspot Inspector"
    sub={isDemo?'Interactive fictional brake, tire and engine callouts':'No connected diagnostic sensors'}/>
    {isDemo&&<label className="at-nv-inspector-select">Inspect sample unit
      <select aria-label="Choose Class C unit for diagnostic illustration"
        value={selected?.id||''} onChange={e=>{
          const found=vehicles.find(v=>v.id===e.target.value);
          if(found)onSelectVehicle(found);
        }}>
        {vehicles.map(v=><option key={v.id} value={v.id}>{v.unit_number} · {v.model||v.vehicle_type}</option>)}
      </select></label>}
    <SubsystemInspector sample={isDemo} vehicle={selected}/></section>
   <section className="at-nv-panel"><SectionTitle title="Maintenance Cost Breakdown"
    sub={isDemo?'Illustrative monthly breakdown':'Service ledger not connected'}/>
    {isDemo?<><Donut series={classCCostBreakdown(h.operatingCosts)}/>
      <div className="at-nv-budget-card"><span>Cost vs Budget</span><strong>90% · $54,000 / $60,000</strong>
       <div className="at-nv-progress"><i style={{width:'90%'}}/></div><small>Sample budget benchmark</small></div></>:
     <Unconnected icon={DollarSign} title="Verified maintenance spending unavailable"
       detail="Cost categories, maintenance budgets and invoices are not part of current fleet inventory."/>}
   </section>
  </div>
  <section className="at-nv-panel"><SectionTitle title="Fleet Operating Costs & Insights"
   sub={isDemo?'Example operating intelligence · not AI-generated from vehicle data':
   'Validated operating records required before automated recommendations can be issued'}/>
    {isDemo?<div className="at-nv-insights">
      <div><Sparkles size={23}/><strong>Priority: transmission inspection</strong>
        <p>Sample transmission attention score 58% suggests review by a qualified technician. This is not a real diagnosis.</p></div>
      <div><AlertTriangle size={23}/><strong>Brake and tire hot spots</strong>
        <p>Example callouts emphasize defects that should trigger manual DVIR review before operation.</p></div>
      <div><Fuel size={23}/><strong>Fuel efficiency opportunity</strong>
        <p>Sample fleet economy 8.6 km/L. Real insight needs validated fuel and mileage reporting.</p></div>
    </div>:
    <Unconnected icon={Sparkles} title="No verified AI fleet insights"
      detail="AI recommendations require audited telemetry and maintenance events, with human confirmation."/>}
  </section>
 </div>;
}
/** Reusable local-driver ribbon at top of Driver Cockpit. No server mutation. */
export function ClassCShiftRibbon({isDemo=false,role='',currentUserId='',organizationId='',vehicles=[],assignments=[],drivers=[],locations=[],demoUnit=''}) {
 const [dvirUnit,setDvirUnit]=useState(null);
 const [showMap,setShowMap]=useState(false);
 const assigned=classCDriverAssignment({assignments,vehicles,currentUserId});
 return <><ShiftBar isDemo={isDemo} role={role} currentUserId={currentUserId}
   vehicles={vehicles} assignments={assignments} drivers={drivers} demoUnit={demoUnit}
   openDvir={setDvirUnit}/>
 <button type="button" className="at-nv-primary" style={{justifySelf:'start'}}
   onClick={()=>setShowMap(v=>!v)} aria-expanded={showMap}>
   <MapPinned size={15}/>{showMap?'Hide my local delivery map':'Show my local delivery map'}
 </button>
 {showMap&&<ClassCMapPanel isDemo={isDemo} role={role}
   currentUserId={currentUserId} vehicles={vehicles}
   assignments={assignments} locations={locations} mode="driver"/>}
 {dvirUnit!==null&&<DvirModal unit={dvirUnit} driverId={currentUserId}
   isDemo={isDemo} role={role} organizationId={organizationId}
   vehicleId={assigned.vehicle?.unit_number===dvirUnit?assigned.vehicle?.id:''}
   assignmentId={assigned.vehicle?.unit_number===dvirUnit?assigned.assignment?.id:''}
   close={()=>setDvirUnit(null)}/>}</>;
}
export default function ClassCOpsDashboard({
 isDemo=false,role='',currentUserId='',organizationId='',vehicles=[],drivers=[],assignments=[],locations=[],
 onOpenDispatch=()=>{},
}){
 const [tab,setTab]=useState('dashboard');
 const [fleetQuery,setFleetQuery]=useState('');
 const [focusAlerts,setFocusAlerts]=useState(false);
 const [showService,setShowService]=useState(false),[dvirUnit,setDvirUnit]=useState(null),
  [localServices,setLocalServices]=useState([]),[notice,setNotice]=useState('');
 const ownActive=classCDriverAssignment({assignments,vehicles,currentUserId});
 const records=useMemo(()=>classCOpsRecords({vehicles,assignments,drivers,role,currentUserId,isDemo}),
   [vehicles,assignments,drivers,role,currentUserId,isDemo]);
 const displayVehicles=isDemo?NORTHVALE_REFERENCE_VEHICLES:records.vehicles;
 const counts=isDemo?NORTHVALE_DEMO.summary:records.counts;
 const visibleVehicles=useMemo(()=>filterClassCFleet(displayVehicles,fleetQuery,{
   drivers:records.drivers,assignments:records.assignments,isDemo,
 }),[displayVehicles,fleetQuery,records.drivers,records.assignments,isDemo]);
 const canFleet=isDemo||role==='admin'||role==='dispatcher';
 const isClassCDriver=role==='driver'&&drivers.some(d=>d.user_id===currentUserId&&d.license_class==='C');
 const [detailUnit,setDetailUnit]=useState(null);
 const focusedUnit=visibleVehicles.find(v=>v.id===detailUnit?.id)||visibleVehicles[0]||null;
 const localScheduled=isDemo?[...NORTHVALE_REFERENCE_SCHEDULE,...localServices]:localServices;
 if(!canFleet&&!isClassCDriver)return <div className="at-nv"><Unconnected
   title="Class C operations access restricted" detail="This workspace is available to authorized fleet staff and their signed-in Class C drivers."/></div>;
 const onDetails=(vehicle,destination='vehicles')=>{
   setDetailUnit(vehicle);if(destination==='documents')setNotice('Vehicle documents are not connected; review your authorized fleet records.');
   else setTab(destination);
 };
 const addService=(draft)=>{setLocalServices(s=>[...s,{...draft,id:'draft-'+Date.now()+'-'+s.length}]);
  setShowService(false);setTab('service');setNotice('Local service appointment added. Not saved to the fleet maintenance system.');};
 return <div className="at-nv">
  <header className="at-nv-header">
   <div className="at-nv-brand"><span><Truck size={24}/></span><div><small>ANDERTRACK / CLASS C OPERATIONS</small>
     <h2>Local Fleet Command</h2><p>Cargo vans · Sprinters · light box trucks · pickups & utility fleets</p></div></div>
   <div className="at-nv-header-actions">
    <label className="at-nv-header-search"><Search size={15}/>
      <input value={fleetQuery} onChange={e=>setFleetQuery(e.target.value)}
       aria-label="Search Class C units, drivers or routes"
       placeholder="Search unit, driver or route…"/>
      {fleetQuery&&<button type="button" aria-label="Clear fleet search"
        onClick={()=>setFleetQuery('')}><X size={14}/></button>}
    </label>
    <button className="at-nv-alert-shortcut" type="button" onClick={()=>{setTab('vehicles');setFocusAlerts(true);}}
     aria-label="Open vehicle health and recent alerts"><Bell size={17}/> Alerts</button>
    <span className="at-nv-mode"><i/>{isDemo?'NORTHVALE-INSPIRED DEMO':'AUTHORIZED LIVE RECORDS'}</span>
    <button className="at-nv-primary" type="button" onClick={onOpenDispatch}>Dispatch workspace <ArrowRight size={14}/></button></div>
  </header>
  <ShiftBar isDemo={isDemo} role={role} currentUserId={currentUserId}
    records={records} vehicles={vehicles} assignments={assignments} drivers={drivers}
    demoUnit={isDemo?focusedUnit?.unit_number??null:undefined}
    openDvir={setDvirUnit}/>
  {records.hasUnverifiedGvwr&&!isDemo&&<div className="at-nv-alert"><ShieldAlert size={16}/>
    Some vehicle GVWR values have not been verified. Category selection alone does not establish non-CDL eligibility.</div>}
  <nav className="at-nv-tabs" aria-label="Local Class C fleet workspace">
    {NORTHVALE_TABS.map((x,i)=><button type="button" key={x.id} onClick={()=>setTab(x.id)}
      aria-current={tab===x.id?'page':undefined} className={tab===x.id?'current':''}>
      {i===0?<LayoutDashboard size={17}/>:i===1?<Truck size={17}/>:i===2?<Wrench size={17}/>:<Activity size={17}/>}
      {x.label}</button>)}
  </nav>
  {fleetQuery.trim()&&<p className="at-nv-search-summary" role="status">
    Showing {visibleVehicles.length} of {displayVehicles.length} {isDemo?'sample vehicles':'authorized Class C units'}
    matching “{fleetQuery}”. This filter affects vehicle displays; it does not hide maintenance or safety reports.
  </p>}
  <p className="at-nv-source-notice"><ShieldCheck size={15}/>{isDemo?
    'DEMO ONLY: all Northvale numbers, fault alerts, service appointments, cost forecasts, vehicle identities and earnings below are fictional.' :
    'LIVE SOURCE: vehicle inventory and authorized assignments only. Maintenance, physical weight, payroll and diagnostic scores are not connected.'}</p>
  {tab==='dashboard'&&<ClassCMapPanel
    isDemo={isDemo} role={role} currentUserId={currentUserId}
    vehicles={vehicles} assignments={assignments} locations={locations}
    visibleVehicleIds={fleetQuery.trim()?visibleVehicles.map(v=>v.id):null}
    globalQuery={fleetQuery}
    mode={role==='driver'&&!isDemo?'driver':'fleet'}/>}
  {tab==='dashboard'&&<DashboardTab vehicles={visibleVehicles} assignments={records.assignments}
    counts={counts} isDemo={isDemo} onService={()=>setTab('service')}
    onDetails={onDetails} schedule={localScheduled}
    selectedUnitId={detailUnit?.id||''} onSelectVehicle={setDetailUnit}/>}
  {tab==='vehicles'&&<VehiclesTab vehicles={visibleVehicles} isDemo={isDemo}
    alerts={isDemo?NORTHVALE_REFERENCE_ALERTS:[]}
    focusId={detailUnit?.id||''} onSelectVehicle={setDetailUnit}
    focusAlerts={focusAlerts} onAlertFocusHandled={()=>setFocusAlerts(false)}/>}
  {tab==='service'&&<ServiceTab vehicles={displayVehicles} isDemo={isDemo}
    schedule={localScheduled} onOpen={()=>setShowService(true)}
    onRemove={id=>setLocalServices(s=>s.filter(x=>x.id!==id))}/>}
  {tab==='service'&&!isDemo&&<FleetMaintenanceCenter
    organizationId={organizationId} role={role} currentUserId={currentUserId}
    vehicles={records.vehicles}/>}
  {tab==='analytics'&&<AnalyticsTab isDemo={isDemo} vehicles={visibleVehicles} counts={counts}
    selectedUnitId={detailUnit?.id||''} onSelectVehicle={setDetailUnit}/>}
  {notice&&<div className="at-nv-flash" role="status">{notice}
    <button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}
  {showService&&<ServiceModal isDemo={isDemo} vehicles={displayVehicles}
    create={addService} cancel={()=>setShowService(false)}/>}
  {dvirUnit!==null&&<DvirModal unit={dvirUnit} driverId={currentUserId}
    isDemo={isDemo} role={role} organizationId={organizationId}
    vehicleId={ownActive.vehicle?.unit_number===dvirUnit?ownActive.vehicle?.id:''}
    assignmentId={ownActive.vehicle?.unit_number===dvirUnit?ownActive.assignment?.id:''}
    close={()=>setDvirUnit(null)}/>}
 </div>;
}
