import React,{useEffect,useMemo,useState} from 'react';
import {
  ArrowRight, BadgeCheck, Calculator, CalendarClock, CheckCircle2,
  ClipboardCheck, Clock3, Download, FileCheck2, RotateCcw,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Truck, Wallet,
} from 'lucide-react';
import {
  DEMO_CHECKLIST,dutySlotToTime,summarizeDutySlots,dutySegmentsFromSlots,
  paintDutyRange,payrollScenario,jurisdictionReconciliation,proofReadiness,dutyScenarioCsv,
  nextDriverMissionStatus,liveDriverMissionCounts,
} from '../../lib/driver-cockpit-pro.js';
import { DUTY_STATES,formatHrsMinutes } from '../../lib/driver-cockpit.js';
import './driver-cockpit-pro.css';

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const roundMiles=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
function exportDemoDuty(segments,name) {
  const csv=dutyScenarioCsv(segments,name);
  const objectUrl=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=objectUrl;
  link.download='SIMULATION-NOT-ELD-'+String(name).replace(/[^a-z0-9-]/ig,'-').slice(0,40)+'.csv';
  document.body.appendChild(link);
  link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}

export function DutyScenarioLab({person,baseSlots}) {
  const [slots,setSlots]=useState(()=>[...baseSlots]);
  const [previous,setPrevious]=useState([]);
  const [cursor,setCursor]=useState(32);
  const [length,setLength]=useState(4);
  const [status,setStatus]=useState('D');
  const [editCount,setEditCount]=useState(0);
  const segments=useMemo(()=>dutySegmentsFromSlots(slots),[slots]);
  const totals=useMemo(()=>summarizeDutySlots(slots),[slots]);
  useEffect(()=>{
    setSlots([...baseSlots]);
    setPrevious([]);
    setCursor(32);
    setStatus(person.status);
    setEditCount(0);
  },[person.id,baseSlots]);

  function applyEdit(){
    if(!DEMO_STATES.has(status))return;
    const updated=paintDutyRange(slots,cursor,length,status);
    if(updated.join('')===slots.join(''))return;
    setPrevious([...slots]);setSlots(updated);setEditCount(n=>n+1);
  }
  function reset(){
    setSlots([...baseSlots]);setPrevious([]);setEditCount(0);
  }

  return <div className="at-pro-lab at-pro-duty" aria-label="Advanced simulated duty log editor">
    <div className="at-pro-head"><div><span>ADVANCED HOS SANDBOX</span><strong>Time-block duty log editor</strong>
      <small>Change quarter-hour blocks and see a reconstructed audit sequence. No certified HOS calculations.</small></div>
      <span className="at-pro-demo-mark">NOT A CERTIFIED ELD</span></div>
    <div className="at-pro-totals">
      {[
        ['Drive',totals.D,'drive'],
        ['On duty',totals.ON,'on'],
        ['Sleeper',totals.SB,'sleeper'],
        ['Off duty',totals.OFF,'off'],
      ].map(([label,mins,tone])=><div key={tone} className={'at-pro-time-'+tone}>
        <small>{label}</small><strong>{formatHrsMinutes(mins)}</strong>
      </div>)}
    </div>
    <div className="at-pro-status-stripe" role="img"
      aria-label="Full simulated 24-hour day divided into quarter-hour duty blocks">
      {slots.map((s,i)=><span key={i} title={dutySlotToTime(i)+' · '+s}
        style={{background:DEMO_COLORS[s]}}/>)}
    </div>
    <div className="at-pro-cursor-details"><strong>Editing from {dutySlotToTime(cursor)}</strong>
      <span>{length*15} minutes · {length} quarter-hour blocks</span></div>
    <input type="range" min="0" max={96-length} step="1" value={Math.min(cursor,96-length)}
      onChange={e=>setCursor(Number(e.target.value))}
      aria-label="Select 15-minute start of simulated duty period"/>
    <div className="at-pro-controls">
      <label>Duration<select value={length} onChange={e=>{const next=Number(e.target.value);
        setLength(next);setCursor(c=>Math.min(c,96-next));}}>
        {[[1,'15 min'],[2,'30 min'],[4,'1 hour'],[8,'2 hours']].map(([n,label])=>
          <option key={n} value={n}>{label}</option>)}
      </select></label>
      <label>Duty category<select value={status} onChange={e=>setStatus(e.target.value)}>
        {DUTY_STATES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
      </select></label>
      <button className="at-pro-primary" type="button" onClick={applyEdit}>
        <CalendarClock size={15}/> Apply block</button>
    </div>
    <div className="at-pro-toolbar">
      <span>{editCount} local edits · {totals.transitions} status transitions</span>
      <button type="button" disabled={!previous.length} onClick={()=>{
        setSlots(previous);setPrevious([]);setEditCount(c=>Math.max(0,c-1));
      }}>Undo</button>
      <button type="button" onClick={reset}><RotateCcw size={13}/> Reset</button>
      <button type="button" onClick={()=>exportDemoDuty(segments,person.name)}>
        <Download size={13}/> Export SAMPLE CSV</button>
    </div>
    <div className="at-pro-segment-list" role="list" aria-label="Reconstructed sample log periods">
      {segments.map((part,i)=><div key={i} role="listitem">
        <span className="at-pro-period-dot" style={{background:DEMO_COLORS[part.status]}}/>
        <strong>{part.start}–{part.end}</strong>
        <span>{DUTY_STATES.find(s=>s.id===part.status)?.label}</span>
        <small>{formatHrsMinutes(part.durationMinutes)}</small>
      </div>)}
    </div>
    <p className="at-pro-caution"><ShieldAlert size={14}/>
      This editor does not apply sleeper-berth splits, break exceptions, cycle resets, local exceptions or real ELD events.
      Downloaded CSVs are explicitly marked SIMULATED, not legal logs.</p>
  </div>;
}
const DEMO_STATES=new Set(DUTY_STATES.map(s=>s.id));
const DEMO_COLORS=Object.fromEntries(DUTY_STATES.map(s=>[s.id,s.color]));

export function EarningsScenarioStudio({earnings}) {
  const [stops,setStops]=useState(3);
  const [tips,setTips]=useState(0);
  const [detention,setDetention]=useState(30);
  const [unitRate,setUnitRate]=useState(15);
  const scenario=useMemo(()=>payrollScenario(earnings,{
    stops,tipDelta:tips,detentionMinutes:detention,perStop:unitRate,detentionHourly:25,
  }),[earnings,stops,tips,detention,unitRate]);
  const chart=[
    ['Current sample shift',scenario.initial,'base'],
    ['Extra stops',scenario.extraStopPay,'stops'],
    ['Additional detention',scenario.extraDetentionPay,'detention'],
    ['Extra tips',scenario.deltaTips,'tips'],
  ];
  return <div className="at-pro-lab" aria-label="Sample driver earnings scenario">
    <div className="at-pro-head"><div><span>DRIVER REVENUE ANALYTICS</span>
      <strong>What-if pay simulator</strong>
      <small>Explore additional stops, tips and detention rates without changing payroll.</small></div>
      <span className="at-pro-demo-mark">ILLUSTRATIVE ONLY</span></div>
    <div className="at-pro-scenario-top">
      <div><small>Sample starting shift</small><strong>{money(scenario.initial)}</strong></div>
      <ArrowRight size={17}/>
      <div><small>Scenario total</small><strong>{money(scenario.total)}</strong></div>
      <span>+{money(scenario.added)} hypothetical</span>
    </div>
    <div className="at-pro-scenarios">
      <label>Additional delivery stops <strong>{stops}</strong>
        <input type="range" min="0" max="16" step="1" value={stops}
          onChange={e=>setStops(Number(e.target.value))}/></label>
      <label>Estimated pay per extra stop <strong>{money(unitRate)}</strong>
        <input type="range" min="5" max="45" step="5" value={unitRate}
          onChange={e=>setUnitRate(Number(e.target.value))}/></label>
      <label>Extra customer tips <strong>{money(tips)}</strong>
        <input type="range" min="0" max="100" step="5" value={tips}
          onChange={e=>setTips(Number(e.target.value))}/></label>
      <label>Extra detention time <strong>{detention} min</strong>
        <input type="range" min="0" max="240" step="15" value={detention}
          onChange={e=>setDetention(Number(e.target.value))}/></label>
    </div>
    <div className="at-pro-waterfall">
      {chart.map(([label,val,tone])=><div key={label}>
        <span>{label}</span>
        <div><i className={'at-pro-bar-'+tone}
          style={{width:(scenario.total>0?Math.max(1,(val/scenario.total)*100):0)+'%'}}/></div>
        <strong>{money(val)}</strong>
      </div>)}
    </div>
    <button type="button" className="at-pro-secondary" onClick={()=>{
      setStops(3);setTips(0);setDetention(30);setUnitRate(15);
    }}><RotateCcw size={14}/> Reset scenario</button>
    <p className="at-pro-caution"><ShieldCheck size={14}/>
      Assumptions are hypothetical. The app has no earnings ledger, tax withholding calculation,
      tip settlement verification or payout account connected.</p>
  </div>;
}

export function PayoutSandbox({balance}) {
  const [stage,setStage]=useState('idle');
  useEffect(()=>setStage('idle'),[balance]);
  return <div className="at-pro-lab at-pro-payout">
    <div className="at-pro-head"><div><span>PAYOUT SIMULATION</span>
      <strong>Two-step cash-out confirmation</strong>
      <small>No bank, provider or payment rail is connected.</small></div>
      <span className="at-pro-demo-mark">NO MONEY MOVES</span></div>
    {stage==='idle'&&<button type="button" className="at-pro-primary" onClick={()=>setStage('confirm')}>
      <Wallet size={16}/> Preview cash out {money(balance)} <ArrowRight size={16}/></button>}
    {stage==='confirm'&&<div className="at-pro-payout-confirm">
      <strong>Confirm simulated action</strong>
      <p>Proceeding will only show a sample confirmation. Your balance will not change and no withdrawal will occur.</p>
      <div><button type="button" onClick={()=>setStage('idle')}>Cancel</button>
        <button type="button" className="at-pro-primary" onClick={()=>setStage('complete')}>Confirm demo</button></div>
    </div>}
    {stage==='complete'&&<div className="at-pro-confirmed" role="status">
      <CheckCircle2 size={17}/><div><strong>Simulated — not paid</strong>
      <small>{money(balance)} remained unchanged. No account was debited or credited.</small></div>
      <button type="button" onClick={()=>setStage('idle')}>Reset</button></div>}
  </div>;
}

export function JurisdictionReconciliationLab({mileage}) {
  const [distances,setDistances]=useState(()=>mileage.states.map(([s,v])=>[s,v]));
  useEffect(()=>setDistances(mileage.states.map(([s,v])=>[s,v])),[mileage]);
  const report=useMemo(()=>jurisdictionReconciliation(distances,mileage.today),[distances,mileage]);
  return <div className="at-pro-lab" aria-label="Sample IFTA jurisdiction mileage reconciliation">
    <div className="at-pro-head"><div><span>JURISDICTION AUDIT LAB</span><strong>State mileage reconciliation</strong>
      <small>Adjust demo jurisdiction figures against the sample daily total.</small></div>
      <span className="at-pro-demo-mark">NOT A TAX RETURN</span></div>
    <div className="at-pro-scenario-top">
      <div><small>Sample reported trip</small><strong>{roundMiles(report.tripTotalMiles)} mi</strong></div>
      <ArrowRight size={17}/>
      <div><small>State mileage sum</small><strong>{roundMiles(report.stateTotalMiles)} mi</strong></div>
      <span className={report.matched?'at-pro-good':'at-pro-warn'}>
        {report.matched?'Illustrative totals agree':
          'Mismatch: '+roundMiles(Math.abs(report.differenceMiles))+' mi'}</span>
    </div>
    <div className="at-pro-ifta-inputs">
      {distances.map(([state,miles],index)=><label key={state}>{state} · simulated miles
        <input type="number" min="0" max="1000000" step="1" value={miles}
          onChange={e=>{const next=[...distances];next[index]=[state,
            e.target.value===''?0:Number(e.target.value)];setDistances(next);}}/>
      </label>)}
    </div>
    <div className="at-pro-toolbar"><span>{distances.length} example jurisdictions</span>
      <button type="button" onClick={()=>setDistances(mileage.states.map(([s,v])=>[s,v]))}>
        <RotateCcw size={13}/> Reset mileage</button></div>
    <p className="at-pro-caution"><ShieldAlert size={14}/>
      This is only a discrepancy preview. It has no GPS boundary crossings, certified odometer,
      purchased fuel, tax rates or audit-grade IFTA reporting.</p>
  </div>;
}

export function StopVerificationLab({person,completed,onReadinessChange}) {
  const [checks,setChecks]=useState([]);
  const [recipient,setRecipient]=useState('');
  const [notes,setNotes]=useState('');
  const readiness=useMemo(()=>proofReadiness(checks,recipient),[checks,recipient]);
  useEffect(()=>onReadinessChange(readiness.ready),[readiness.ready,onReadinessChange]);
  function toggle(id) {
    if(completed)return;
    setChecks(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
  }
  return <div className="at-pro-lab at-pro-stop" aria-label="Interactive simulated customer handoff checklist">
    <div className="at-pro-head"><div><span>MISSION EXECUTION · DEMO</span><strong>Customer delivery verification</strong>
      <small>Structured handoff steps and fictional ePOD readiness checks.</small></div>
      <span className="at-pro-demo-mark">NO REAL CUSTOMER PROOF</span></div>
    <div className="at-pro-mission-progress">
      <span><strong>{readiness.completed}/{readiness.total}</strong> preparation tasks</span>
      <div className="at-pro-status-stripe"><i style={{width:readiness.completed/readiness.total*100+'%'}}/></div>
    </div>
    <div className="at-pro-checklist">
      {DEMO_CHECKLIST.map(item=><label key={item.id}>
        <input type="checkbox" checked={checks.includes(item.id)}
          onChange={()=>toggle(item.id)} disabled={completed}/>
        <span>{item.label}</span>
      </label>)}
    </div>
    <label className="at-pro-recipient">Sample recipient / signature label
      <input type="text" value={recipient} maxLength={90}
        disabled={completed} placeholder="e.g., Sample Receiving Clerk"
        onChange={e=>setRecipient(e.target.value)}/>
    </label>
    <label className="at-pro-recipient">Delivery note (local preview)
      <textarea rows={2} value={notes} disabled={completed} maxLength={300}
        placeholder="e.g., Example pallet condition"
        onChange={e=>setNotes(e.target.value)}/>
    </label>
    <div className={'at-pro-readiness '+(readiness.ready?'ready':'pending')}>
      {readiness.ready?<BadgeCheck size={18}/>:<ClipboardCheck size={18}/>}
      <div><strong>{completed?'Sample delivery acknowledged':
        readiness.ready?'Ready to simulate delivery':'Complete checklist and enter a sample recipient'}</strong>
      <small>Required for the on-screen demo completion button only. No evidence file is created.</small></div>
    </div>
    <p className="at-pro-caution"><ShieldCheck size={14}/>
      Real ePOD still requires the signed-in assigned driver, protected package scans,
      authenticated photo upload and a successful Supabase delivery-confirmation RPC.</p>
  </div>;
}

/** Actual authorized driver's assignments. Read-only intelligence; existing RPC handles state transitions. */
export function LiveDriverMission({assignments=[],activeAssignment=null,profile=null}) {
  const counts=liveDriverMissionCounts(assignments);
  const decision=nextDriverMissionStatus(activeAssignment);
  const scheduled=decision.scheduledDeliveryAt?
    new Date(decision.scheduledDeliveryAt).toLocaleString():'Not scheduled';
  const stages=['offered','accepted','at_pickup','picked_up','in_transit','delivered'];
  const activeIndex=stages.indexOf(activeAssignment?.status);
  return <section className="at-surface at-pro-live-mission" aria-label="Authorized driver mission control">
    <div className="at-pro-head"><div><span>AUTHENTICATED DRIVER MISSION CONTROL</span>
      <strong>My dispatch & delivery readiness</strong>
      <small>Derived from your authorized shipment records, not a simulated trip or predicted ETA.</small>
    </div><span className="at-pro-live-mark">LIVE ASSIGNMENTS</span></div>
    <div className="at-pro-mission-metrics">
      {[
        ['My shipments',counts.total],['Active loads',counts.active],
        ['Pending offers',counts.offers],['Delivered',counts.delivered],
      ].map(([name,num])=><div key={name}><small>{name}</small><strong>{num}</strong></div>)}
    </div>
    {activeAssignment?<><div className="at-pro-live-action">
      <div><small>Next recorded-workflow step</small>
        <strong>{decision.label}</strong><p>{decision.instructions}</p>
      </div><span>{activeAssignment.reference||'Assigned load'}</span>
    </div>
    <div className="at-pro-live-timeline" role="list" aria-label="Current shipment status milestones">
      {stages.map((status,index)=><div key={status}
        role="listitem" className={index===activeIndex?'current':index<activeIndex?'earlier':'future'}>
        <i/><span>{status.replaceAll('_',' ')}</span></div>)}
    </div>
    <div className={'at-pro-deadline at-pro-'+decision.scheduleKind}>
      <CalendarClock size={17}/><div><strong>{decision.scheduleKind==='past-due'?
        'Scheduled delivery time has passed':decision.scheduleKind==='approaching'?
        'Scheduled delivery within two hours':'Recorded delivery schedule'}</strong>
      <small>{scheduled} · Actual arrival time and compliance are not predicted.</small></div>
    </div>
    </>:<div className="at-pro-live-action"><ShieldCheck size={20}/>
      No shipment is currently selected. Your authorized offers and shipments will appear here when assigned.</div>}
    <p className="at-pro-caution"><ShieldCheck size={14}/>
      Only the signed-in driver's assignments are shown. Actual status changes and proofs must be completed through the server-authorized controls below; this panel never bypasses RLS.</p>
  </section>;
}
