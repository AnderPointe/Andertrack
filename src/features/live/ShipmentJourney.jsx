import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, ClipboardList, Clock3,
  Download, FileCheck2, History, PackageCheck, RefreshCw, ShieldCheck, Truck, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildJourney, journeyMilestones, journeySchedule, journeyCsv } from '../../lib/shipment-journey.js';
import './shipment-journey.css';

const FILTERS = [
  ['all', 'All events'],
  ['assignment', 'Assignment'],
  ['package', 'Package scans'],
  ['proof', 'Delivery proof'],
];
const formatTimestamp = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available'
    : date.toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'});
};
function downloadCsv(entries, reference) {
  if (!entries.length) return;
  const safeReference = String(reference || 'shipment').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,60);
  const csv = '\uFEFF' + journeyCsv(entries);
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'andertrack-journey-' + safeReference + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function demoRecords(assignment) {
  if (!assignment?.id) return {assignmentEvents:[],packageEvents:[],proof:null,packages:[]};
  const base = Number.isFinite(Date.parse(assignment.created_at))
    ? Date.parse(assignment.created_at) : Date.parse('2026-10-17T12:00:00Z');
  const add = minutes => new Date(base + minutes*60_000).toISOString();
  const stages = [
    ['offer',10,'unassigned','offered'],
    ['accept',25,'offered','accepted'],
    ['arrive_pickup',50,'accepted','at_pickup'],
    ['pickup',70,'at_pickup','picked_up'],
    ['start_transit',85,'picked_up','in_transit'],
    ['deliver',140,'in_transit','delivered'],
  ];
  const stageCount = {
    unassigned:0,offered:1,accepted:2,at_pickup:3,picked_up:4,in_transit:5,delivered:6,
  }[assignment.status] || 0;
  const assignmentEvents = stages.slice(0,stageCount).map(([action,minutes,previous_status,next_status],index)=>({
    id:'demo-'+index,assignment_id:assignment.id,action,previous_status,next_status,
    occurred_at:add(minutes),actor_user_id:null,
  }));
  const proof = assignment.status==='delivered'
    ? {id:'demo-proof',confirmed_at:add(145)} : null;
  const packages = assignment.division==='Class C'
    ? [{id:'demo-parcel',tracking_code:'SAMPLE-001'}] : [];
  const packageEvents = stageCount>=4 && packages.length
    ? [{id:'demo-scan-1',assignment_id:assignment.id,package_id:'demo-parcel',action:'pickup',
      scanned_at:add(75),actor_user_id:null}] : [];
  return {assignmentEvents,packageEvents,proof,packages};
}

/**
 * Read-only Control Tower audit panel. Source permissions are enforced by
 * Supabase RLS. No public evidence URLs, recipient names or GPS coordinates.
 */
export default function ShipmentJourney({
  assignment, organizationId, currentUserId, role, isDemo=false, compact=false,
}) {
  const [filter,setFilter] = useState('all');
  const [snapshot,setSnapshot] = useState({scope:'',assignmentEvents:[],packageEvents:[],proof:null,packages:[]});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const generation = useRef(0);
  const scope = [currentUserId,organizationId,assignment?.id].join(':');
  const isAssigned = Boolean(currentUserId && assignment?.driver_user_id === currentUserId);
  const canRead = !isDemo && Boolean(organizationId && assignment?.id && currentUserId) &&
    (role === 'admin' || role === 'dispatcher' || (role === 'driver' && isAssigned));

  const refresh = useCallback(async () => {
    if (!canRead || !supabase) return;
    const seq=++generation.current;
    setLoading(true);
    setError('');
    try {
      const [a,p,proof,manifest] = await Promise.all([
        supabase.from('at_assignment_events')
          .select('id,assignment_id,actor_user_id,action,previous_status,next_status,occurred_at')
          .eq('organization_id',organizationId).eq('assignment_id',assignment.id)
          .order('occurred_at',{ascending:false}).limit(200),
        supabase.from('at_package_events')
          .select('id,assignment_id,package_id,actor_user_id,action,scanned_at')
          .eq('organization_id',organizationId).eq('assignment_id',assignment.id)
          .order('scanned_at',{ascending:false}).limit(200),
        supabase.from('at_delivery_proofs')
          .select('id,confirmed_at')
          .eq('organization_id',organizationId).eq('assignment_id',assignment.id)
          .maybeSingle(),
        supabase.from('at_assignment_packages')
          .select('id,tracking_code')
          .eq('organization_id',organizationId).eq('assignment_id',assignment.id)
          .limit(200),
      ]);
      if (generation.current!==seq) return;
      const failure=[a,p,proof,manifest].find(q=>q.error);
      if(failure) {
        setError(failure.error.message || 'History is temporarily unavailable.');
      } else {
        setSnapshot({
          scope,
          assignmentEvents:a.data||[],
          packageEvents:p.data||[],
          proof:proof.data||null,
          packages:manifest.data||[],
        });
      }
    } catch(e) {
      if(generation.current===seq) setError(e?.message || 'History is temporarily unavailable.');
    } finally {
      if(generation.current===seq) setLoading(false);
    }
  },[canRead,organizationId,assignment?.id,scope]);

  useEffect(() => {
    generation.current++;
    setFilter('all');
    setSnapshot({scope:'',assignmentEvents:[],packageEvents:[],proof:null,packages:[]});
    setError('');
    if(!canRead) return undefined;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState==='visible') void refresh();
    },30000);
    return () => {generation.current++;clearInterval(timer);};
  },[canRead,refresh]);

  const data = useMemo(() => isDemo ? demoRecords(assignment)
    : snapshot.scope===scope ? snapshot
    : {assignmentEvents:[],packageEvents:[],proof:null,packages:[]},
    [isDemo,assignment,snapshot,scope]);
  const labels = useMemo(() => Object.fromEntries(data.packages.map(p=>[p.id,p.tracking_code])),[data.packages]);
  const entries = useMemo(() => buildJourney({
    assignment,assignmentEvents:data.assignmentEvents,packageEvents:data.packageEvents,
    proof:data.proof,packageLabels:labels,
  }),[assignment,data,labels]);
  const milestones = useMemo(() => journeyMilestones(assignment,data.assignmentEvents),
    [assignment,data.assignmentEvents]);
  const schedule = journeySchedule(assignment);
  const shown = entries.filter(e=>filter==='all'||e.kind===filter);
  const percent = milestones.length
    ? Math.round(100*milestones.filter(m=>m.complete).length/milestones.length) : 0;

  if (!assignment || (!isDemo && !canRead)) return null;

  return <section className={'at-surface at-journey '+(compact?'at-journey-compact':'')}
    aria-label={'Shipment event timeline for '+(assignment.reference||'shipment')}>
    <div className="at-journey-heading">
      <div className="at-journey-name">
        <span className="at-journey-heading-icon"><History size={20}/></span>
        <div><span className="at-kicker">PHASE 6 / SHIPMENT CONTROL TOWER</span>
          <h2>Shipment journey <span>{assignment.reference}</span></h2></div>
      </div>
      <div className="at-journey-buttons">
        <button type="button" onClick={()=>downloadCsv(shown,assignment.reference)}
          disabled={shown.length===0} title="Export visible timeline events as CSV">
          <Download size={16}/> Export
        </button>
        {!isDemo&&<button type="button" onClick={()=>refresh()} disabled={loading}
          aria-label="Refresh shipment events"><RefreshCw size={16} className={loading?'at-spinning':''}/></button>}
      </div>
    </div>

    {isDemo&&<div className="at-journey-demo"><ShieldCheck size={16}/>
      Illustrative event history only. No Supabase records are accessed or updated.</div>}
    <div className="at-journey-statrow">
      <div><span>Recorded milestone coverage</span><strong>{percent}%</strong><small>Based on available audit events, not physical trip progress</small></div>
      <div><span>Assignment events</span><strong>{data.assignmentEvents.length}</strong><small>Latest 200 records per source</small></div>
      <div><span>Package custody scans</span><strong>{data.packageEvents.length}</strong><small>Recorded pickup and delivery scans</small></div>
      <div><span>Private delivery proof</span><strong>{data.proof?'Recorded':'Not recorded'}</strong><small>No photo or recipient data shown</small></div>
    </div>

    <div className="at-journey-milestones" role="list" aria-label="Milestone audit coverage">
      {milestones.map((m,i)=><div key={m.id} role="listitem"
        className={'at-journey-step '+(m.complete?'complete':'pending')}>
        <span className="at-journey-step-dot">{m.complete?<CheckCircle2 size={16}/>:String(i+1)}</span>
        <strong>{m.label}</strong>
      </div>)}
    </div>

    <div className={'at-journey-watch at-journey-watch-'+schedule.kind}>
      {schedule.kind==='late'?<AlertTriangle size={18}/>:<Clock3 size={18}/>}
      <div><strong>{schedule.label}</strong>
        {schedule.due&&<small>Scheduled for {formatTimestamp(schedule.due)}. This is not an ETA forecast.</small>}</div>
    </div>

    <div className="at-journey-sectionhead"><div><span className="at-kicker">VERIFIED EVENT STREAM</span>
      <h3>Audit timeline</h3></div><span className="at-count">{shown.length} visible events</span></div>
    <div className="at-journey-filters" role="group" aria-label="Filter event history">
      {FILTERS.map(([id,label])=><button type="button" key={id}
        className={filter===id?'selected':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>

    {error&&<div className="at-journey-error" role="alert"><AlertTriangle size={16}/>{error}
      <button type="button" onClick={()=>refresh()}>Retry</button></div>}
    {!error&&loading&&entries.length===0&&<p className="at-journey-status" role="status">Loading authorized shipment history…</p>}
    <div className="at-journey-entries" role="list">
      {shown.map(entry=>{
        const Icon=entry.kind==='package'?PackageCheck:entry.kind==='proof'?FileCheck2:Activity;
        return <article key={entry.id} role="listitem" className={'at-journey-event at-journey-'+entry.kind}>
          <span className="at-journey-event-icon"><Icon size={16}/></span>
          <div className="at-journey-event-main"><strong>{entry.title}</strong>
            <p>{entry.detail}</p><time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time></div>
          <span className="at-journey-kind">{entry.kind}</span>
        </article>;
      })}
      {!error&&!loading&&shown.length===0&&<div className="at-journey-empty">
        <ClipboardList size={26}/><strong>No events in this view</strong>
        <p>Only actual recorded audit events appear here. Older workflow stages may not have event rows.</p>
      </div>}
    </div>
    <div className="at-journey-footer"><ShieldCheck size={15}/>
      Read-only, organization-scoped history. No public proof files, recipient data or simulated GPS positions.
    </div>
  </section>;
}
