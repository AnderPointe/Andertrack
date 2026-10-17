import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BatteryMedium, CirclePause, CirclePlay,
  Clock3, Crosshair, Gauge, MapPinned, Navigation, Radio, RefreshCw, Route, ShieldCheck,
  Signal, SlidersHorizontal, Truck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { validGpsPosition,freshGpsPosition } from '../../lib/operations.js';
import {
  DEFAULT_GEOFENCE_MILES,HISTORY_WINDOWS,replayPoints,traceSummary,
  fleetObservations,fencePosition,geoDistanceMiles,
} from '../../lib/fleet-intelligence.js';
import FleetReplayMap from './FleetReplayMap.jsx';
import './fleet-intelligence.css';

const numberText=(v,suffix='')=>v==null||!Number.isFinite(Number(v))?'—':String(Math.round(Number(v)))+suffix;
const formattedTime=value=>{
  const n=Date.parse(value||'');
  return Number.isFinite(n)?new Date(n).toLocaleString():'Not reported';
};
const DEMO_OFFSETS=[
  [-.026,-.033],[-.023,-.028],[-.017,-.021],[-.014,-.016],
  [-.010,-.007],[-.005,-.002],[0,0],[.006,.008],[.011,.013],[.017,.022],
];
function demoTrail(unit) {
  if(!validGpsPosition(unit))return [];
  const anchor=Date.now();
  return DEMO_OFFSETS.map(([lat,lng],i)=>({
    id:'SAMPLE-'+i,driver_id:unit.driver_id||'DEMO',unit_number:unit.unit_number||'SAMPLE',
    latitude:Number(unit.latitude)+lat,longitude:Number(unit.longitude)+lng,
    recorded_at:new Date(anchor-(DEMO_OFFSETS.length-1-i)*6*60000).toISOString(),
    speed_mph:i===0?0:24+i*4,accuracy_meters:11+i*3,
    heading:60+i*2,
  }));
}
/** Phase 7 pilot: live position, trace replay and local geofence in one protected workspace. */
export default function FleetIntelligence({locations=[],role='',organizationId='',currentUserId='',isDemo=false}) {
  const planner=role==='admin'||role==='dispatcher'||isDemo;
  const [selectedDriver,setSelectedDriver]=useState('');
  const [historyWindow,setHistoryWindow]=useState('24h');
  const [rows,setRows]=useState([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyError,setHistoryError]=useState('');
  const [historyStatus,setHistoryStatus]=useState('');
  const [selectedIndex,setSelectedIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [fence,setFence]=useState(null);
  const [radiusMiles,setRadiusMiles]=useState(DEFAULT_GEOFENCE_MILES);
  const requestRef=useRef(0);
  const selectedLocation=locations.find(l=>l.driver_id===selectedDriver)||locations[0]||null;
  const driverId=selectedLocation?.driver_id||'';
  const isAuthorized=planner && !isDemo && !!organizationId && !!currentUserId;
  const demo=isDemo && validGpsPosition(selectedLocation);
  const history=useMemo(()=>demo?demoTrail(selectedLocation):rows,
    [demo,selectedLocation?.id,selectedLocation?.driver_id,selectedLocation?.latitude,selectedLocation?.longitude,rows]);
  const points=useMemo(()=>replayPoints(history),[history]);
  const stats=useMemo(()=>traceSummary(points),[points]);
  const activeIndex=Math.max(0,Math.min(selectedIndex,Math.max(0,points.length-1)));
  const activePoint=points[activeIndex]||null;
  const observations=useMemo(()=>fleetObservations(locations,fence),[locations,fence]);

  const refresh=useCallback(async()=>{
    const id=driverId;
    if(!isAuthorized||!id||!supabase) {
      setRows([]);
      setHistoryError('');
      return;
    }
    const generation=++requestRef.current;
    setHistoryLoading(true);
    setHistoryError('');
    const since=new Date(Date.now()-HISTORY_WINDOWS[historyWindow]).toISOString();
    try{
      const {data,error}=await supabase.from('driver_location_events')
        .select('id,company_id,driver_id,unit_number,latitude,longitude,heading,speed_mph,accuracy_meters,battery_percent,signal_strength,status,recorded_at')
        .eq('company_id',organizationId).eq('driver_id',id)
        .gte('recorded_at',since).order('recorded_at',{ascending:false}).limit(500);
      if(requestRef.current!==generation)return;
      if(error) {
        setRows([]);
        setHistoryError(error.message||'GPS history is not authorized.');
        setHistoryStatus('History access unavailable');
      } else {
        setRows(data||[]);
        setSelectedIndex(Math.max(0,(data||[]).length-1));
        setHistoryStatus((data||[]).length>=500?'Showing latest 500 samples · more may exist':'History read complete');
      }
    }catch(err){
      if(requestRef.current!==generation)return;
      setRows([]);
      setHistoryError(err?.message||'Unable to retrieve location history.');
    }finally{if(requestRef.current===generation)setHistoryLoading(false);}
  },[driverId,historyWindow,organizationId,isAuthorized]);

  useEffect(()=>{
    setPlaying(false);
    setSelectedIndex(0);
    requestRef.current++;
    setRows([]);
    setHistoryError('');
    if(!isAuthorized || !driverId) return undefined;
    void refresh();
    const timer=setInterval(()=>{
      if(document.visibilityState==='visible')void refresh();
    },60000);
    return ()=>{requestRef.current++;clearInterval(timer);};
  },[refresh,isAuthorized,driverId]);

  useEffect(()=>{
    if(!playing||points.length<2)return undefined;
    const timer=setInterval(()=>setSelectedIndex(previous=>{
      if(previous>=points.length-1){setPlaying(false);return previous;}
      return previous+1;
    }),1000);
    return ()=>clearInterval(timer);
  },[playing,points.length]);

  const chooseUnit=id=>{
    setPlaying(false);setSelectedIndex(0);setSelectedDriver(id);
    setFence(null);
  };
  const setCircle=center=>{setFence({...center,radiusMiles});};
  const updateRadius=miles=>{
    setRadiusMiles(miles);
    setFence(old=>old?{...old,radiusMiles:miles}:null);
  };

  if(!planner)return <section className="at-surface at-fleet-security">
    <ShieldCheck size={24}/><strong>Dispatcher-only fleet intelligence</strong>
    <p>Recorded fleet history is available only to approved organization administrators and dispatchers.</p>
  </section>;

  return <div className="at-fleet-intel">
    <section className="at-surface at-fleet-intro">
      <div><span className="at-kicker">PHASE 7 · ADVANCED FLEET INTELLIGENCE</span>
        <h2><Radio size={22}/> Live vehicle intelligence & route replay</h2>
        <p>Explore reported speed, heading, GPS trace segments and local monitoring zones. This is a review tool, not navigation, a telematics certification, or a compliance determination.</p>
      </div>
      <div className="at-fleet-intro-state"><ShieldCheck size={17}/>
        {isDemo?'SAMPLE / SYNTHETIC MOVEMENT':historyError?'GPS HISTORY NOT AVAILABLE':historyStatus||'AUTHORIZED TELEMETRY ONLY'}</div>
    </section>

    <section className="at-fleet-selector at-surface">
      <div className="at-fleet-selector-title"><span className="at-kicker">FLEET UNITS</span>
        <strong>{locations.length} current position records</strong></div>
      {locations.length===0?<div className="at-fleet-no-units">
        <Truck size={23}/><div><strong>No GPS devices reporting</strong>
        <span>Production has no current vehicle positions. When your collector starts recording authorized pings, vehicles will appear here.</span></div>
      </div>:<div className="at-fleet-unit-list">{locations.map((unit,index)=>{
        const key=unit.id||unit.driver_id||('unit-'+index);
        const selected=selectedLocation===unit;
        return <button type="button" key={key} onClick={()=>chooseUnit(unit.driver_id||'')}
          className={'at-fleet-unit '+(selected?'selected':'')}>
          <Truck size={18}/><span><strong>{unit.unit_number||unit.vehicle_type||'Fleet unit'}</strong>
            <small>{freshGpsPosition(unit)?'Reported in last 5 minutes':'GPS not recent'}
            {' · '}{unit.status||'Unknown status'}</small></span><ArrowRight size={16}/>
        </button>;
      })}</div>}
    </section>

    <div className="at-fleet-intel-grid">
      <section className="at-surface at-fleet-replay">
        <div className="at-fleet-replay-head">
          <div><span className="at-kicker">GEOINTELLIGENCE / TRACE REPLAY</span>
            <h3>Recorded vehicle movement</h3></div>
          <div className="at-fleet-replay-actions">
            <select aria-label="GPS history time window" value={historyWindow} onChange={e=>setHistoryWindow(e.target.value)}>
              {Object.keys(HISTORY_WINDOWS).map(w=><option key={w} value={w}>{w} history</option>)}
            </select>
            <button type="button" aria-label="Refresh GPS history" onClick={()=>refresh()} disabled={!isAuthorized||historyLoading||!driverId}>
              <RefreshCw size={16}/>
            </button>
          </div>
        </div>
        <FleetReplayMap key={organizationId+':'+selectedLocation?.driver_id+':'+(isDemo?'demo':'live')}
          points={points} selectedIndex={activeIndex} unit={selectedLocation}
          fence={fence} onChooseCenter={setCircle}/>
        <div className="at-fleet-replay-controller">
          <div className="at-fleet-replay-controls">
            <button type="button" aria-label={playing?'Pause replay':'Play replay'} disabled={points.length<2}
              onClick={()=>setPlaying(v=>!v)}>
              {playing?<CirclePause size={26}/>:<CirclePlay size={26}/>}</button>
            <div><strong>{activePoint?formattedTime(activePoint.recorded_at):'No recorded route to replay'}</strong>
              <small>{points.length?activeIndex+1+' of '+points.length+' verified GPS samples':'Connect a secured GPS event feed'}</small>
            </div>
          </div>
          <input type="range" min={0} max={Math.max(0,points.length-1)} value={activeIndex}
            aria-label="Scrub GPS route timeline" disabled={!points.length}
            onChange={e=>{setPlaying(false);setSelectedIndex(Number(e.target.value));}} />
          {historyLoading&&<small role="status">Refreshing GPS history…</small>}
          {historyError&&<div className="at-fleet-history-error" role="alert"><AlertTriangle size={15}/>
            GPS history could not load: {historyError}. A reviewed organization-scoped RLS policy may be needed.</div>}
          {!isDemo&&!historyLoading&&!historyError&&!points.length&&<small className="at-fleet-history-empty">
            No authorized historical GPS samples in this window. Empty playback is expected until the collector and history access are enabled.</small>}
          {points.length>=500&&<small className="at-fleet-history-empty">Replay is limited to the 500 most recent samples.</small>}
        </div>
      </section>

      <div className="at-fleet-intel-side">
        <section className="at-surface at-fleet-telemetry">
          <div className="at-fleet-title"><span className="at-kicker">VEHICLE TELEMETRY</span><h3>Latest reported snapshot</h3></div>
          <div className="at-fleet-telemetry-grid">
            {[
              ['Reported speed',numberText(selectedLocation?.speed_mph,' mph'),Gauge],
              ['Heading',numberText(selectedLocation?.heading,'°'),Navigation],
              ['Accuracy',numberText(selectedLocation?.accuracy_meters,' m'),Crosshair],
              ['Battery',numberText(selectedLocation?.battery_percent,'%'),BatteryMedium],
              ['Signal',numberText(selectedLocation?.signal_strength),Signal],
              ['Latest ping',freshGpsPosition(selectedLocation)?'Recent':'Stale / unknown',Clock3],
            ].map(([name,value,Icon])=><div key={name}><Icon size={17}/><span>{name}</span><strong>{value}</strong></div>)}
          </div>
          <p>Vehicle values are reported by devices. No inferred speed or predicted ETA is displayed.</p>
        </section>

        <section className="at-surface at-fleet-telemetry">
          <div className="at-fleet-title"><span className="at-kicker">GPS TRACE QUALITY</span><h3>History analysis</h3></div>
          <div className="at-fleet-telemetry-grid">
            {[
              ['Valid samples',stats.points],
              ['Accepted segments',stats.segments],
              ['Straight segments',stats.straightSegmentMiles+' mi'],
              ['Flagged jumps',stats.suspectJumps],
            ].map(([label,value])=><div key={label}><Route size={17}/><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <p>Distance sums straight GPS segments, excludes impossible jumps and is not a road distance or odometer reading. Trace may be incomplete.</p>
        </section>

        <section className="at-surface at-fleet-telemetry at-fleet-fence">
          <div className="at-fleet-title"><span className="at-kicker">LOCAL GEOFENCE LAB</span><h3>Monitoring circle</h3></div>
          <p>Click the map to place a temporary circle, then select its radius. Review only; no automatic geofence enforcement or notifications.</p>
          <label htmlFor="at-fence-radius">Circle radius</label>
          <select id="at-fence-radius" value={radiusMiles} onChange={e=>updateRadius(Number(e.target.value))}>
            {[1,3,5,10,25,50].map(m=><option key={m} value={m}>{m} miles</option>)}
          </select>
          <div className="at-fleet-fence-status">
            <MapPinned size={17}/><span>{!fence?'Click map to define a center':
              'Current unit: '+fencePosition(selectedLocation,fence)+' monitoring circle'}</span>
          </div>
          {fence&&<button type="button" onClick={()=>setFence(null)}>Clear monitoring circle</button>}
        </section>
      </div>
    </div>

    <section className="at-surface at-fleet-observations">
      <div className="at-fleet-title"><span className="at-kicker">REVIEW-ONLY SIGNALS</span><h3>Fleet observations</h3></div>
      <p>Signals use current location pings and a configurable review threshold. They are not legal speeding alerts, verified incidents or historical geofence crossings.</p>
      {observations.length===0?<div className="at-fleet-observation-empty"><ShieldCheck size={19}/>
        No current-position observations. A missing GPS feed is not interpreted as healthy operations.</div>:
        <div className="at-fleet-signal-list">{observations.slice(0,25).map(o=><div key={o.id}>
          <span className={'at-fleet-signal-bubble '+o.kind}><AlertTriangle size={17}/></span>
          <div><strong>{o.title}</strong><small>{o.detail}</small></div>
          <span>{o.severity==='high'?'REVIEW':'CHECK'}</span>
        </div>)}</div>}
    </section>
  </div>;
}
