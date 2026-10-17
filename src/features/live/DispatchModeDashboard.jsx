import React,{useEffect,useMemo,useState} from 'react';
import {
  Activity,ArrowRight,CheckCircle2,ChevronDown,Clock3,ExternalLink,
  Gauge,MapPinned,MessageCircle,Navigation,Package,Plus,Radio,
  Route,Search,Send,ShieldAlert,ShieldCheck,Truck,Users,
} from 'lucide-react';
import FleetMap from './FleetMap.jsx';
import {
  selectedDispatchAssignment,dispatchModeSummary,dispatchRouteLink,
  DEMO_DISPATCH_MESSAGES,DEMO_DURATION_SERIES,
} from '../../lib/reference-dashboards.js';
import './reference-dashboards.css';

const nice=value=>String(value||'Not recorded').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const timeStamp=value=>{
  const date=Date.parse(value||'');
  return Number.isFinite(date)?new Date(date).toLocaleString():'Not recorded';
};
function DemoTimeChart(){
  const toPolyline=key=>DEMO_DURATION_SERIES.map((p,i)=>
    (20+i*108)+','+(155-p[key]*4.6)).join(' ');
  return <svg viewBox="0 0 710 210" role="img"
    className="at-rdash-duration-chart" aria-label="Synthetic estimated versus actual trip-duration sample chart">
    {[0,5,10,15,20,25,30].map((val,i)=>
      <g key={val}><line x1="20" x2="690" y1={155-val*4.6} y2={155-val*4.6} stroke="#ffffff13"/>
        <text x="3" y={160-val*4.6} fill="#88999a" fontSize="10">{val}</text></g>)}
    <polyline fill="none" stroke="#21d9ab" strokeWidth="3" strokeLinecap="round"
      strokeLinejoin="round" points={toPolyline('estimated')}/>
    <polyline fill="none" stroke="#9cadad" strokeWidth="2.6" strokeLinecap="round"
      strokeLinejoin="round" points={toPolyline('actual')}/>
    {DEMO_DURATION_SERIES.map((v,i)=><text key={v.label} fill="#94aaa9" fontSize="10"
      x={14+i*108} y="186">{v.label}m</text>)}
    <text x="20" y="204" fill="#57bfa4" fontSize="11">— Sample estimated</text>
    <text x="176" y="204" fill="#b7c3c3" fontSize="11">— Sample actual</text>
  </svg>;
}
export default function DispatchModeDashboard({
  assignments=[],drivers=[],vehicles=[],locations=[],role='',isDemo=false,organizationId='',
  onReviewLoad=()=>{},onOpenQueue=()=>{},onOpenFleet=()=>{},
}) {
  const planner=isDemo||role==='admin'||role==='dispatcher';
  const [selectedId,setSelectedId]=useState('');
  const [search,setSearch]=useState('');
  const [chatText,setChatText]=useState('');
  const [demoChats,setDemoChats]=useState({});
  const [showAll,setShowAll]=useState(false);
  const items=useMemo(()=>assignments.filter(a=>[a.reference,a.customer_name,a.dropoff_address]
    .join(' ').toLowerCase().includes(search.trim().toLowerCase())),[assignments,search]);
  const selected=selectedDispatchAssignment(items,selectedId);
  const view=dispatchModeSummary(selected,drivers,vehicles,locations);
  const location=view?.gps||null;
  const link=dispatchRouteLink(selected);
  const messages=selected?(demoChats[selected.id]||DEMO_DISPATCH_MESSAGES):[];
  const liveRecent=locations.filter(l=>l.last_ping_at&&Date.now()>=Date.parse(l.last_ping_at)
    &&Date.now()-Date.parse(l.last_ping_at)<=300000).length;
  const mapPositions=location?[location]:[];
  const focusedKey=organizationId+':'+(selected?.id||'none')+':'+(isDemo?'demo':'live');
  useEffect(()=>setChatText(''),[selected?.id,organizationId]);
  function sendDemo(event) {
    event.preventDefault();
    const clean=chatText.trim();
    if(!isDemo||!selected||!clean)return;
    const newEntry={id:'ui-'+Date.now()+'-'+messages.length,speaker:'dispatcher',text:clean,
      time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
    setDemoChats(prev=>({...prev,[selected.id]:[...(prev[selected.id]||DEMO_DISPATCH_MESSAGES),newEntry]}));
    setChatText('');
  }
  if(!planner)return <section className="at-surface at-rdash-denied"><ShieldCheck size={26}/>
    <h2>Dispatch Mode requires dispatcher access</h2>
    <p>Use your driver cockpit for authorized assignments. The company-wide dispatch view is restricted.</p></section>;
  return <div className="at-rdash at-rdash-dispatch">
    <div className="at-rdash-dispatch-nav"><div className="at-rdash-transport-logo"><Route size={25}/></div>
      <div className="at-rdash-dispatch-links"><span className="active">DISPATCH MODE</span>
        <button onClick={onOpenQueue}>Dispatch queue</button>
        <button onClick={onOpenFleet}>My fleet</button>
        <span className="at-rdash-source-label">{isDemo?'SAMPLE DATA':'AUTHORIZED LIVE DATA'}</span>
      </div></div>
    <div className="at-rdash-dispatch-head"><div><span className="at-rdash-kicker">LIVE OPERATIONS / MULTIMODAL DELIVERY</span>
      <h2>Dispatch Mode</h2><p>Vehicle tracking, load context, handoffs and dispatcher communication in one workspace.</p></div>
      <span className="at-rdash-live"><Radio size={15}/>{isDemo?'Illustrative demo':'Live assignment feed'}</span></div>
    <section className="at-rdash-panel at-rdash-dispatch-select">
      <label className="at-rdash-search"><Search size={16}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Filter loads by customer, route or reference" aria-label="Filter dispatch loads"/></label>
      <select value={selected?.id||''} onChange={e=>setSelectedId(e.target.value)}
        aria-label="Select active dispatch load">
        {items.length===0&&<option value="">No matching loads</option>}
        {items.map(a=><option key={a.id} value={a.id}>
          {a.reference||'Load'} · {a.customer_name||'Customer'} · {nice(a.status)}
        </option>)}
      </select>
      <div className="at-rdash-dispatch-pills">
        <span><Package size={14}/>{items.length} visible loads</span>
        <span><Radio size={14}/>{liveRecent} recent GPS reporters</span>
      </div>
    </section>
    <div className="at-rdash-dispatch-columns">
      <div className="at-rdash-dispatch-left">
        <section className="at-rdash-panel at-rdash-dispatch-map-card">
          <div className="at-rdash-section-title"><h3>Real-time Fleet Position</h3>
            <span className="at-rdash-source-label">{isDemo?'SAMPLE GPS':'FRESH REPORTED GPS'}</span></div>
          <div className="at-rdash-dispatch-map">
            {location?<FleetMap key={focusedKey} locations={mapPositions} theme="dark"/>:
              <div className="at-rdash-map-empty"><MapPinned size={30}/><strong>No authorized recent position</strong>
                <span>No GPS trace or route can be drawn for this selected shipment.</span></div>}
          </div>
          <div className="at-rdash-route-addresses">
            <div><span className="at-rdash-route-dot pickup"/><div>
              <small>Pick Up Address</small><strong>{selected?.pickup_address||'Not recorded'}</strong></div></div>
            <div><span className="at-rdash-route-dot dropoff"/><div>
              <small>Drop Off Address</small><strong>{selected?.dropoff_address||'Not recorded'}</strong></div></div>
          </div>
          <div className="at-rdash-map-controls"><button type="button" onClick={()=>selected&&onReviewLoad(selected.id)}
            disabled={!selected}><Package size={14}/> Open assignment</button>
            {link?<a href={link} target="_blank" rel="noopener noreferrer"><Navigation size={15}/>
              Road directions <ExternalLink size={12}/></a>:
              <span className="at-rdash-muted">No complete route addresses</span>}
          </div>
          <p className="at-rdash-panel-note">Markers represent reported GPS only. Andertrack has not calculated a driving route, traffic ETA or commercial-vehicle clearance.</p>
        </section>
        <section className="at-rdash-panel at-rdash-duration-card">
          <div className="at-rdash-section-title"><h3>Trip Duration: Estimated vs. Actual</h3>
            <span className="at-rdash-source-label">{isDemo?'ILLUSTRATIVE GRAPH':'TIME FEED REQUIRED'}</span></div>
          {isDemo?<><DemoTimeChart/>
            <p className="at-rdash-panel-note">Example timing series only — no actual driver timings.</p></>:
            <div className="at-rdash-unavailable"><Activity size={29}/>
              <strong>Trip timing comparison unavailable</strong>
              <span>Recorded arrival and road travel-time events are required before estimated-versus-actual charts can be shown.</span>
            </div>}
        </section>
      </div>
      <div className="at-rdash-dispatch-right">
        <section className="at-rdash-panel at-rdash-dispatch-details">
          <div className="at-rdash-section-title"><h3>Basic Details</h3><button
            type="button" className="at-rdash-text-button" disabled={!selected}
            onClick={()=>selected&&onReviewLoad(selected.id)}>View shipment <ArrowRight size={14}/></button></div>
          <div className="at-rdash-dispatch-meta">
            <div className="at-rdash-meta-table">{[
              ['Vehicle unit',view?.vehicle?.unit_number||location?.unit_number||'Not assigned'],
              ['Vehicle type',view?.vehicle?.vehicle_type?.replaceAll('_',' ')||'Not recorded'],
              ['Assigned driver',view?.driver?.display_name||'Not assigned'],
              ['Shipment',selected?.reference||'No selection'],
              ['Status',nice(selected?.status)],
              ['Scheduled pickup',timeStamp(selected?.scheduled_pickup_at)],
              ['Estimated distance',selected?.estimated_miles==null?'Unknown':selected.estimated_miles+' mi (dispatch estimate)'],
            ].map(([a,b])=><div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
            <div className="at-rdash-vehicle-art"><Truck size={92}/><span>{view?.vehicle?.unit_number||'FLEET UNIT'}</span>
              <small>Equipment information only · photo feed not connected</small></div>
          </div>
        </section>
        <section className="at-rdash-panel at-rdash-chat">
          <div className="at-rdash-section-title"><h3><MessageCircle size={18}/> Chat with Driver</h3>
            <span className="at-rdash-source-label">{isDemo?'LOCAL DEMO CHAT':'MESSAGING NOT CONNECTED'}</span></div>
          <p className="at-rdash-chat-target">{view?.driver?.display_name||'No driver assigned'}
            {' · '}{view?.vehicle?.unit_number||'Unassigned vehicle'}</p>
          {isDemo?<><div className="at-rdash-chat-log" aria-label="Illustrative dispatch conversation" role="log">
            {messages.map(m=><div key={m.id} className={'at-rdash-bubble '+m.speaker}>
              <div>{m.text}</div><small>{m.time} · {m.speaker==='driver'?'Example driver':'Example dispatch'}</small>
            </div>)}</div>
            <form className="at-rdash-chat-compose" onSubmit={sendDemo}><label className="at-rdash-chat-input">
              <input aria-label="Demo dispatch message" maxLength={300} placeholder="Enter a demo message…"
                value={chatText} onChange={e=>setChatText(e.target.value)}/></label>
              <button type="submit" disabled={!chatText.trim()} aria-label="Send local demo message"><Send size={17}/></button></form>
            <p className="at-rdash-panel-note">Demo messages stay on this page only. No real driver receives them.</p>
          </>:<div className="at-rdash-chat-unavailable"><ShieldAlert size={27}/>
            <strong>Two-way messaging is not connected</strong>
            <p>No message table or transport has been configured. This panel will not pretend messages were delivered.</p>
            <button type="button" onClick={onOpenQueue}>Open dispatch workflow <ArrowRight size={14}/></button></div>}
        </section>
      </div>
    </div>
    <div className="at-rdash-integrity"><ShieldCheck size={16}/>
      {isDemo?'Sample preview: chat, history graph, positions and assignments are fictitious.':
      'Live dispatch data is limited to verified organization-scoped records; chat, road ETA and trip duration comparison are not connected.'}</div>
  </div>;
}
