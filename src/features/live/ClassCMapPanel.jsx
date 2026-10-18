import React,{useMemo,useState} from 'react';
import {ArrowRight,Compass,ExternalLink,MapPinned,Navigation,Radio,
  Search,ShieldAlert,ShieldCheck,Truck} from 'lucide-react';
import FleetMap from './FleetMap.jsx';
import {classCMapStats,classCDirectionsUrl,classCPositionUrl,filterClassCMapPositions}
  from '../../lib/class-c-maps.js';
import './class-c-maps.css';

const friendlyDate=value=>{
  if(!value||!Number.isFinite(Date.parse(value)))return 'Not reported';
  return new Date(value).toLocaleString();
};

export default function ClassCMapPanel({
  vehicles=[],assignments=[],locations=[],isDemo=false,
  role='',currentUserId='',mode='fleet',visibleVehicleIds=null,globalQuery='',
}) {
  const isDriver=role==='driver'&&!isDemo;
  const [selectedId,setSelectedId]=useState('');
  const [search,setSearch]=useState('');
  const now=Date.now();
  const stats=useMemo(()=>classCMapStats({
    vehicles,assignments,locations,role,currentUserId,isDemo,now,
  }),[vehicles,assignments,locations,role,currentUserId,isDemo,now]);
  const all=stats.positioned;
  // Search is display-only: compute headline counts from the entire authorized scope.
  const visible=filterClassCMapPositions(all,visibleVehicleIds);
  const filtered=visible.filter(x=>[x.unit,x.assignment?.reference,x.vehicle?.make,
    x.vehicle?.model].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  // Never retain a previously selected pin that no longer matches either search.
  const chosen=filtered.find(x=>x.id===selectedId)||null;
  const positions=chosen?[chosen.location]:filtered.map(x=>x.location);
  const routeUnit=chosen||filtered[0]||null;
  const link=classCDirectionsUrl(routeUnit?.assignment);
  const positionLink=classCPositionUrl(routeUnit?.location);
  return <section className="at-nv-panel at-class-c-map-panel">
    <div className="at-class-c-map-title">
      <div><span className="at-class-c-map-eyebrow"><MapPinned size={15}/>
          {isDriver?'MY ACTIVE CLASS C GPS':'CLASS C FLEET GPS'}</span>
        <h3>{mode==='driver'?'My Delivery Position & Directions':'Live Vehicle Map & Dispatch Routes'}</h3>
        <p>Current reported positions for eligible, actively assigned Class C equipment only.</p>
      </div>
      <span className="at-class-c-map-live"><Radio size={13}/>
        {isDemo?'SYNTHETIC SAMPLE FEED':'RLS-AUTHORIZED GPS'}</span>
    </div>
    <div className="at-class-c-map-metrics">
      <div><Truck size={16}/><strong>{stats.eligibleVehicles}</strong><span>Class C equipment</span></div>
      <div><Navigation size={16}/><strong>{stats.activeClassCLoads}</strong><span>Active assignments</span></div>
      <div><Radio size={16}/><strong>{stats.visibleGps}</strong><span>Fresh assigned GPS pings</span></div>
    </div>
    {globalQuery.trim()&&<p className="at-class-c-map-filter-note" role="status">
      Showing GPS pins for {visible.length} reporting {visible.length===1?'vehicle':'vehicles'} matching
      the fleet search. Summary counters cover all authorized Class C records.
      {!filtered.length?' No fresh GPS positions match both searches.':''}
    </p>}
    <div className="at-class-c-map-layout">
      <div className="at-class-c-map-map-frame">
        <FleetMap key={(chosen?.id||'all')+':'+search+':'+globalQuery} locations={positions} theme="light"
          className="at-class-c-fleet-map"
          onChoose={point=>{
            const matched=filtered.find(x=>x.location.id===point.id ||
              (x.driverId===point.driver_id&&x.unit===point.unit_number));
            if(matched)setSelectedId(matched.id);
          }}/>
      </div>
      <aside className="at-class-c-map-side">
        {!isDriver&&<label className="at-class-c-map-search"><Search size={15}/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setSelectedId('');}}
            placeholder="Search unit or load" aria-label="Search Class C fleet GPS"/></label>}
        {!isDriver&&<div className="at-class-c-map-pickers">
          <button type="button" className={!chosen?'selected':''} onClick={()=>setSelectedId('')}>
            All reporting vehicles <span>{filtered.length}</span></button>
          {filtered.map(unit=><button type="button" key={unit.id}
             className={selectedId===unit.id?'selected':''} onClick={()=>setSelectedId(unit.id)}>
            <Truck size={15}/><span>{unit.unit||'Vehicle'}<small>{unit.assignment.reference||'Assigned load'}</small></span>
            <ArrowRight size={13}/></button>)}
          {!filtered.length&&<p>No fresh, linked GPS positions match this search.</p>}
        </div>}
        <div className="at-class-c-map-detail">
          <h4>{routeUnit?.unit||'No current assigned GPS'}</h4>
          {routeUnit?<div className="at-class-c-map-facts">
            <div><span>Assigned shipment</span><strong>{routeUnit.assignment.reference||'Load'}</strong></div>
            <div><span>Status</span><strong>{String(routeUnit.location.status||routeUnit.assignment.status||'reported').replaceAll('_',' ')}</strong></div>
            <div><span>Reported at</span><strong>{friendlyDate(routeUnit.lastPing)}</strong></div>
            <div><span>Vehicle speed</span><strong>{Number.isFinite(Number(routeUnit.location.speed_mph))&&
                routeUnit.location.speed_mph!==null?
                Math.round(Number(routeUnit.location.speed_mph))+' mph':'Not reported'}</strong></div>
            <div><span>Pickup</span><strong>{routeUnit.assignment.pickup_address||'Not recorded'}</strong></div>
            <div><span>Drop-off</span><strong>{routeUnit.assignment.dropoff_address||'Not recorded'}</strong></div>
          </div>:<p>No current authorized GPS position is linked to an active Class C vehicle.
              Confirm the vehicle assignment and driver GPS permissions.</p>}
          <div className="at-class-c-map-actions">
            {link&&<a href={link} target="_blank" rel="noopener noreferrer">
              <Navigation size={15}/> Directions in Google Maps <ExternalLink size={13}/></a>}
            {positionLink&&<a href={positionLink} target="_blank" rel="noopener noreferrer"
              className="outline"><MapPinned size={15}/> Open reported position <ExternalLink size={13}/></a>}
            {!link&&<span className="at-class-c-map-no-link">Route link appears when both addresses exist.</span>}
          </div>
        </div>
      </aside>
    </div>
    <p className="at-class-c-map-note"><ShieldCheck size={14}/>
      {isDemo?'Demo vehicle locations are simulated, not real-time tracking. ':
        'Only fresh GPS records from the active, authorized driver-to-unit assignment are mapped. '}
      GPS updates are not continuous navigation, and Google Maps driving directions are not certified
      routing for restricted commercial vehicles. Opening a route shares its addresses with Google.</p>
  </section>;
}
