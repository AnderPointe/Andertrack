import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Compass, Database,
  ExternalLink, Gauge, LockKeyhole, MapPinned, Navigation, Route,
  Search, ShieldCheck, ShieldAlert, SlidersHorizontal, Sparkles, Truck, Users,
  Weight, XCircle,
} from 'lucide-react';
import { dispatchMatches, externalRoadRouteUrl, getDispatchQueueHead,
  planningSummary, validPickupCoordinates, DISTANCE_LABEL } from '../../lib/dispatch-planner.js';
import { supabase } from '../../lib/supabase.js';
import { loadDispatchSafetySnapshot } from '../../lib/fleet-maintenance-api.js';
import { normalizeSafetySnapshot,SAFETY_SNAPSHOT_STATE } from '../../lib/fleet-safety-interlocks.js';
import './dispatch-planner.css';

const printable = value => String(value || 'Unknown').replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase());
const unitTime = value => {
  if(!value) return 'Not scheduled';
  const d=new Date(value);
  return Number.isNaN(d.valueOf())?'Not scheduled':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
};
const TABS=[['recommended','Qualified pairs'],['all','Review all pairs']];
const numberValue = v => Number.isFinite(v) ? v.toFixed(1)+' mi' : 'GPS not available';

/**
 * Phase 8 dispatcher-only scenario analysis. No write methods are invoked.
 * Actual queued offers must still use the protected FIFO dispatch workflow.
 */
export default function DispatchPlanner({
  assignments=[],drivers=[],vehicles=[],locations=[],requests=[],
  organizationId='',role='',isDemo=false,onReviewLoad=()=>{},onOpenDispatch=()=>{},
}) {
  const planner=role==='admin'||role==='dispatcher'||isDemo;
  const [loadId,setLoadId]=useState('');
  const [latitude,setLatitude]=useState('');
  const [longitude,setLongitude]=useState('');
  const [weight,setWeight]=useState('');
  const [tab,setTab]=useState('recommended');
  const [pairLimit,setPairLimit]=useState(8);
  const [filter,setFilter]=useState('');
  const [safety,setSafety]=useState({state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,
    organizationId:'',holds:[],coveredVehicleIds:[],checkedAt:null});
  useEffect(()=>{
    if(isDemo || !planner || !organizationId) {
      setSafety({state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,
        organizationId,holds:[],coveredVehicleIds:[],checkedAt:null});
      return undefined;
    }
    let active=true;
    const fetchSafety=async()=>{
      setSafety(previous=>previous.organizationId===organizationId ?
        previous:{state:SAFETY_SNAPSHOT_STATE.LOADING,organizationId,
          holds:[],coveredVehicleIds:[],checkedAt:null});
      try{
        const rows=await loadDispatchSafetySnapshot(supabase,{organizationId});
        if(active)setSafety(normalizeSafetySnapshot(rows,organizationId));
      }catch(_error){
        if(active)setSafety({state:SAFETY_SNAPSHOT_STATE.UNAVAILABLE,
          organizationId,holds:[],coveredVehicleIds:[],checkedAt:null});
      }
    };
    fetchSafety();
    const interval=setInterval(fetchSafety,45000);
    return ()=>{active=false;clearInterval(interval);};
  },[organizationId,isDemo,planner]);
  const waiting=useMemo(()=>[...assignments].filter(a=>a.status==='unassigned'&&!a.driver_user_id)
    .sort((a,b)=>Date.parse(a.scheduled_pickup_at||a.created_at||0)-Date.parse(b.scheduled_pickup_at||b.created_at||0)),
    [assignments]);
  const selected=waiting.find(a=>a.id===loadId)||waiting[0]||null;
  const queueHead=getDispatchQueueHead(requests);
  const coordinates=validPickupCoordinates(latitude,longitude);
  const invalidCoordinates=(latitude.trim()||longitude.trim())&&!coordinates;
  const validWeight=weight.trim()===''?null:Number(weight);
  const invalidWeight=weight.trim()!==''&&(!Number.isFinite(validWeight)||validWeight<=0);
  useEffect(()=>{
    setLatitude('');setLongitude('');setWeight('');setTab('recommended');setFilter('');
  },[selected?.id,organizationId]);

  const pairings=useMemo(()=>dispatchMatches({
    load:selected,drivers,vehicles,assignments,requests,locations,
    pickup:coordinates,requiredWeightLbs:weight.trim()===''?null:weight,now:Date.now(),
    safetySnapshot:isDemo?null:safety,safetyOrganizationId:organizationId,
  }),[selected,drivers,vehicles,assignments,requests,locations,latitude,longitude,weight,safety,organizationId,isDemo]);
  const summary=planningSummary(pairings,requests,coordinates,weight);
  const shown=pairings.filter(p=>(tab==='all'||p.eligible)&&
    (!filter.trim()||[p.driverName,p.vehicleName,p.vehicleClass,p.vehicleType].join(' ')
      .toLowerCase().includes(filter.toLowerCase().trim()))).slice(0,pairLimit);
  const routeUrl=externalRoadRouteUrl(selected);

  if(!planner) return <section className="at-surface at-dispatch-access">
    <LockKeyhole size={26}/><h2>Dispatch planning requires an approved planner role</h2>
    <p>Only organization administrators and dispatchers can access the matching scenarios.</p>
  </section>;

  return <div className="at-dispatch-planner">
    <section className="at-surface at-planner-hero">
      <div className="at-planner-hero-copy">
        <span className="at-kicker">PHASE 8 · INTELLIGENT DISPATCH</span>
        <h2><Sparkles size={24}/> Dispatch Decision Studio</h2>
        <p>Compare eligible drivers and equipment, check queue order, and plan road routes using real operational records. Matching is explainable and approval remains with your dispatcher.</p>
        <div className="at-planner-hero-pills"><span><ShieldCheck size={14}/> FIFO protected</span>
          <span><Database size={14}/> Organization-scoped</span>
          <span><SlidersHorizontal size={14}/> Scenario planning only</span></div>
      </div>
      <div className="at-planner-hero-signal"><Gauge size={25}/>
        <strong>Dispatch intelligence</strong><small>Recommendations, not automatic assignments</small></div>
    </section>

    {isDemo&&<div className="at-planner-demo"><ShieldCheck size={16}/>
      SAMPLE ENVIRONMENT · No live assignments, dispatch claims or road routing requests are made.</div>}

    <section className="at-surface at-planner-safety" aria-label="Phase 10 fleet safety evidence">
      <ShieldAlert size={20}/>
      <div><strong>{isDemo?'Sample fleet safety screening':
        safety.state===SAFETY_SNAPSHOT_STATE.READY?
          'Fleet safety snapshot loaded':'Safety screening unavailable — recommendations held'}</strong>
        <p>{isDemo?'Demo recommendations use fictional data and do not grant dispatch permission.':
          safety.state===SAFETY_SNAPSHOT_STATE.READY?
            safety.holds.length+' units with open out-of-service DVIR holds. '+safety.coveredVehicleIds.length+
              ' units screened by the organization-scoped read-only RPC. Server-side enforcement is still required.':
            'The authenticated safety read or migration is unavailable. No pair may be recommended without a current snapshot; use established safety procedures.'}</p>
        <small>Screening is advisory. Database trigger must independently block unsafe offers and acceptance; administrative DVIR closure is not certified roadworthiness clearance.</small>
      </div>
    </section>
    <div className="at-planner-stats">
      {[
        ['Unassigned loads',waiting.length,Route],
        ['Qualified driver roster',drivers.filter(d=>d.license_verified&&d.availability==='available').length,Users],
        ['Enabled fleet units',vehicles.filter(v=>v.enabled).length,Truck],
        ['FIFO requests waiting',requests.filter(r=>r.status==='queued').length,Clock3],
      ].map(([label,count,Icon])=><section key={label} className="at-surface at-planner-stat">
        <div><span>{label}</span><Icon size={18}/></div><strong>{count}</strong>
      </section>)}
    </div>

    <div className="at-planner-layout">
      <div className="at-planner-left">
        <section className="at-surface at-planner-panel">
          <div className="at-planner-section-title"><span className="at-kicker">01 / SELECT SHIPMENT</span>
            <h3>Plan a dispatch scenario</h3></div>
          <label htmlFor="at-planner-load">Eligible unassigned shipment</label>
          <select id="at-planner-load" value={selected?.id||''}
            onChange={e=>setLoadId(e.target.value)}>
            {waiting.length===0&&<option value="">No unassigned shipments</option>}
            {waiting.map(a=><option key={a.id} value={a.id}>{a.reference||'Shipment'} · {a.division||'Division'} · {a.customer_name||'Customer'}</option>)}
          </select>
          {selected?<div className="at-planner-load-detail">
            <div><small>Pickup</small><strong>{selected.pickup_address||'Not recorded'}</strong></div>
            <div><small>Delivery</small><strong>{selected.dropoff_address||'Not recorded'}</strong></div>
            <div><small>Division</small><strong>{selected.division||'Unknown'}</strong></div>
            <div><small>Scheduled pickup</small><strong>{unitTime(selected.scheduled_pickup_at)}</strong></div>
          </div>:<div className="at-planner-empty"><Route size={26}/><strong>No load ready for matching</strong>
            <span>When a shipment is unassigned, it will appear here without generating a fabricated offer.</span></div>}
          <div className="at-planner-buttons">
            <button type="button" disabled={!selected} onClick={()=>onReviewLoad(selected.id)}>
              <Route size={16}/> Review in dispatch <ArrowRight size={15}/>
            </button>
            <button type="button" disabled={!routeUrl} onClick={()=>routeUrl&&window.open(routeUrl,'_blank','noopener,noreferrer')}>
              <Navigation size={16}/> Open road route <ExternalLink size={14}/>
            </button>
          </div>
          <p className="at-planner-note">Road directions open in Google Maps and use recorded addresses. Andertrack does not calculate a driving ETA, truck-safe routing or optimize multi-stop routes.</p>
        </section>

        <section className="at-surface at-planner-panel">
          <div className="at-planner-section-title"><span className="at-kicker">02 / ADJUST SCENARIO</span>
            <h3>Pickup & equipment checks</h3></div>
          <p className="at-planner-note">Pickup coordinates are not stored in the current shipment schema. Enter verified GPS coordinates only when known to compare straight-line proximity.</p>
          <div className="at-planner-fields">
            <div><label htmlFor="at-pickup-lat">Pickup latitude</label>
              <input id="at-pickup-lat" type="number" step="any" min="-90" max="90"
                placeholder="e.g. 31.9974" value={latitude} onChange={e=>setLatitude(e.target.value)}/></div>
            <div><label htmlFor="at-pickup-lng">Pickup longitude</label>
              <input id="at-pickup-lng" type="number" step="any" min="-180" max="180"
                placeholder="e.g. -102.0779" value={longitude} onChange={e=>setLongitude(e.target.value)}/></div>
          </div>
          {invalidCoordinates&&<p className="at-planner-validation" role="status"><ShieldAlert size={14}/>
            Enter both coordinates within valid latitude/longitude ranges.</p>}
          <label htmlFor="at-payload-weight">Proposed shipment payload (lb, optional)</label>
          <input id="at-payload-weight" type="number" min="1" step="1" placeholder="Not recorded — leave blank"
            value={weight} onChange={e=>setWeight(e.target.value)}/>
          {invalidWeight&&<p className="at-planner-validation" role="status"><ShieldAlert size={14}/>
            Use a payload weight greater than zero.</p>}
          <p className="at-planner-note">
            {weight.trim()===''?'Payload capacity is NOT checked without a verified weight.':
              'Entered weight applies only to this local scenario; unknown or insufficient vehicle capacity blocks recommendations.'}
            {' '}{DISTANCE_LABEL}
          </p>
        </section>

        <section className="at-surface at-planner-panel at-planner-fifo">
          <div className="at-planner-section-title"><span className="at-kicker">03 / DISPATCH QUEUE</span>
            <h3>Server-controlled FIFO</h3></div>
          {queueHead?<><div className="at-planner-fifo-callout"><Clock3 size={20}/><div>
            <strong>Oldest request takes priority</strong>
            <small>Queue #{queueHead.queue_number} · {drivers.find(d=>d.user_id===queueHead.driver_user_id)?.display_name||'Queued driver'}</small></div></div>
            <p className="at-planner-note">While a queue exists, only its first driver can appear as a qualified match. The server validates and claims the queue head through the existing dispatch workflow.</p>
          </>:<div className="at-planner-fifo-callout clear"><CheckCircle2 size={20}/><div>
            <strong>No queued requests</strong><small>Compare verified, available drivers for manual offers.</small></div></div>}
          <button type="button" className="at-planner-dispatch-link" onClick={onOpenDispatch}>
            Open authorized FIFO controls <ArrowRight size={16}/>
          </button>
        </section>
      </div>

      <div className="at-planner-right">
        <section className="at-surface at-planner-panel at-planner-recommendations">
          <div className="at-planner-section-title">
            <span className="at-kicker">ELIGIBILITY ENGINE / EXPLAINABLE MATCHING</span>
            <h3>Driver and vehicle recommendations</h3>
          </div>
          <div className="at-planner-result-head">
            <div className="at-planner-result-number"><strong>{summary.ready}</strong><span>qualified pairings</span></div>
            <div className="at-planner-result-number"><strong>{summary.evaluated}</strong><span>evaluated pairs</span></div>
            <div className="at-planner-result-number"><strong>{summary.unverifiedGps}</strong><span>qualified · no current GPS</span></div>
          </div>
          <div className="at-planner-recommendation-note">
            <ShieldCheck size={17}/><div>
              <strong>How recommendations are ordered</strong>
              <p>First satisfy license, availability, vehicle, current assignments, payload scenario and FIFO priority.
                If fresh GPS and manually entered pickup coordinates are available, eligible pairs are ordered by straight-line proximity. No AI prediction or automated dispatch.</p>
            </div>
          </div>
          <div className="at-planner-result-controls">
            <div className="at-planner-switches" role="group" aria-label="Candidate eligibility view">
              {TABS.map(([id,label])=><button type="button" key={id}
                className={tab===id?'selected':''} onClick={()=>{setTab(id);setPairLimit(8);}}>{label}</button>)}
            </div>
            <label className="at-planner-candidate-search"><Search size={17}/>
              <input value={filter} onChange={e=>setFilter(e.target.value)}
                placeholder="Find driver or unit…" aria-label="Search dispatch pairings"/></label>
          </div>
          {shown.length?<div className="at-planner-match-list">{shown.map((pair,index)=>
            <article key={pair.id} className={'at-planner-match '+(pair.eligible?'ready':'blocked')}>
              <span className="at-planner-pair-rank">{pair.eligible?<CheckCircle2 size={18}/>:<ShieldAlert size={18}/>}</span>
              <div className="at-planner-pair-copy">
                <div className="at-planner-pair-title"><strong>{pair.driverName}</strong>
                  <span className="at-planner-pair-separator">+</span><strong>{pair.vehicleName}</strong>
                  <span className={'at-planner-pair-tag '+(pair.eligible?'ready':'blocked')}>{pair.eligible?'QUALIFIED':'REVIEW'}</span></div>
                <p>Driver class {pair.licenseClass||'—'} · Equipment class {pair.vehicleClass||'—'}
                  {' · '}{pair.vehicleType||'Vehicle'}</p>
                <div className="at-planner-pair-metadata">
                  <span><MapPinned size={13}/>{pair.distanceMiles==null?'Pickup distance unavailable':
                    numberValue(pair.distanceMiles)+' straight-line to pickup'}</span>
                  <span><Weight size={13}/>{pair.payloadChecked?
                    (pair.capacityLbs==null?'Capacity unknown':'Vehicle max '+Math.round(pair.capacityLbs).toLocaleString()+' lb'):
                    'Payload not verified'}</span>
                  {pair.fifoHead&&<span className="at-planner-priority"><Clock3 size={13}/> FIFO first</span>}
                </div>
                {pair.reasons.length>0&&<div className="at-planner-reasons">
                  {pair.reasons.map(reason=><span key={reason}>{reason}</span>)}</div>}
              </div>
            </article>
          )}</div>:<div className="at-planner-empty">
            <Truck size={28}/><strong>{selected?'No pairings in this view':'Select an unassigned load'}</strong>
            <span>{selected?'Try reviewing all pairs or complete driver and equipment onboarding. No match will be fabricated.':
              'Only unassigned shipments qualify for scenario planning.'}</span>
          </div>}
          {pairings.length>shown.length&&
            <button type="button" className="at-planner-show-more"
              onClick={()=>setPairLimit(n=>n+12)}>Show more evaluated combinations <ArrowRight size={15}/></button>}
          <p className="at-planner-note at-planner-footer">
            <LockKeyhole size={14}/> These checks are advisory. The existing server-side RPCs recheck actual qualifications,
            current assignments and queue order. Endorsements, HOS, insurance and real road conditions are not verified here.
          </p>
        </section>
      </div>
    </div>
  </div>;
}
