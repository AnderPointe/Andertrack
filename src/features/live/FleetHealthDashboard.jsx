import React,{useEffect,useMemo,useState} from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bell, CheckCircle2, ChevronLeft,
  ChevronRight, CircleHelp, Gauge, HeartPulse, Radio, Search, ShieldAlert,
  ShieldCheck, SlidersHorizontal, Truck, Wrench, X,
} from 'lucide-react';
import {
  operationalVehicleRows,fleetHealthCounts,fleetHealthFilter,
  fleetHealthBreakdown,
} from '../../lib/reference-dashboards.js';
import './reference-dashboards.css';

const fmtTime=(value,now)=>{
  const stamp=Date.parse(value||'');
  if(!Number.isFinite(stamp))return 'Not reported';
  const mins=Math.round((now-stamp)/60000);
  if(mins>=0&&mins<60)return mins+' min ago';
  return new Date(stamp).toLocaleString();
};
const sampleTrend=[61,72,69,78,83,71,63,69,75,77,64,73,80];
const trendPoints=sampleTrend.map((v,i)=>[20+i*58,145-(v-30)*1.63]);
function DemoTrend() {
  const line=trendPoints.map(([x,y])=>x+','+y).join(' ');
  return <svg className="at-rdash-trend" viewBox="0 0 760 170" role="img"
    aria-label="Synthetic fleet score history for interface demonstration only">
    {[40,75,110,145].map(y=><line key={y} x1="20" x2="740" y1={y} y2={y} stroke="#ffffff18"/>)}
    <path d={'M'+trendPoints.map(([x,y])=>x+' '+y).join(' L')+' L716 145 L20 145 Z'}
      fill="#ff91251c"/>
    <polyline points={line} fill="none" stroke="#ff8e25" strokeWidth="3"
      strokeLinejoin="round" strokeLinecap="round"/>
    {trendPoints.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3" fill="#ff952a"/>)}
    <g fill="#778188" fontSize="10">{['Apr 23','Apr 25','Apr 27','Apr 29','May 1','May 3','May 5']
      .map((x,i)=><text x={20+i*116} y={165} key={x}>{x}</text>)}</g>
  </svg>;
}
const segments=[
  {label:'Excellent (80–100)',color:'#169b49'},
  {label:'Good (60–79)',color:'#74b331'},
  {label:'Fair (40–59)',color:'#ff8d19'},
  {label:'Poor (20–39)',color:'#ec3834'},
  {label:'Critical (0–19)',color:'#aa2420'},
];
function GaugeScore({score}) {
  const available=score!=null;
  const angle=available?Math.round(Math.min(100,Math.max(0,score))*1.8):0;
  return <div className="at-rdash-gauge" role="img" aria-label={available?
    'Sample fleet health score '+score+' of 100':'Fleet mechanical health score unavailable'}>
    <div className="at-rdash-gauge-track" style={{'--health-turn':angle+'deg'}}/>
    <div className="at-rdash-gauge-value"><strong>{available?score:'N/A'}</strong>
      <span>{available?' / 100':'NO SENSOR FEED'}</span>
      <small>{available?'Sample score only':'Diagnostics not connected'}</small></div>
  </div>;
}
export default function FleetHealthDashboard({
  vehicles=[],drivers=[],assignments=[],locations=[],isDemo=false,
  role='',now=Date.now(),onViewFleet=()=>{},onViewTracking=()=>{},
}) {
  const planner=isDemo||role==='admin'||role==='dispatcher';
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [sort,setSort]=useState('unit');
  const [page,setPage]=useState(0);
  const [focused,setFocused]=useState('');
  const rows=useMemo(()=>operationalVehicleRows({vehicles,drivers,assignments,locations,isDemo,now}),
    [vehicles,drivers,assignments,locations,isDemo,now]);
  const counts=fleetHealthCounts(rows);
  const visible=useMemo(()=>fleetHealthFilter(rows,{search,status,sort}),[rows,search,status,sort]);
  const pageCount=Math.max(1,Math.ceil(visible.length/6));
  const safePage=Math.min(page,pageCount-1);
  const displayed=visible.slice(safePage*6,(safePage+1)*6);
  const selected=rows.find(r=>r.id===focused)||null;
  useEffect(()=>setPage(0),[search,status,sort]);
  const breakdown=fleetHealthBreakdown(rows);
  const alerts=isDemo?rows.flatMap(r=>r.sampleAlerts.map(a=>({...a,unit:r.unitNumber,id:r.id+':'+a.title}))):[];
  if(!planner)return <section className="at-surface at-rdash-denied">
    <ShieldCheck size={27}/><h2>Fleet Health is available to authorized dispatchers</h2>
    <p>Company-wide vehicle data requires admin or dispatcher access.</p></section>;
  return <div className="at-rdash at-rdash-fleet">
    <div className="at-rdash-topbar"><div className="at-rdash-title"><span className="at-rdash-logo"><Activity size={24}/></span>
      <div><span className="at-rdash-kicker">ANDERTRACK / FLEET OPERATIONS</span><h2>Fleet Health</h2></div></div>
      <div className="at-rdash-live"><Radio size={14}/>{isDemo?'SAMPLE FLEET DATA':'AUTHENTICATED LIVE INVENTORY'}</div></div>
    <div className="at-rdash-stat-strip">
      <div className="at-rdash-stat-intro"><strong>Fleet Health Overview</strong>
        <span>{isDemo?'Sample maintenance and telematics display':
          'Live vehicle availability and reporting · mechanical health not connected'}</span></div>
      {[
        ['Total vehicles',counts.total,''],
        ['Active GPS + load',counts.active,'teal'],
        ['GPS idle',counts.idle,''],
        ['Not reporting',counts.notReporting,'amber'],
        ['Disabled',counts.disabled,'red'],
      ].map(([label,value,tone])=><div className={'at-rdash-stat '+tone} key={label}>
        <span>{label}</span><strong>{value}</strong><Truck size={20}/></div>)}
    </div>
    <div className="at-rdash-fleet-grid">
      <section className="at-rdash-panel at-rdash-fleet-table">
        <div className="at-rdash-section-title"><div><h3>Fleet Status</h3>
          <p>{visible.length} of {rows.length} registered vehicles</p></div>
          <button type="button" className="at-rdash-text-button" onClick={onViewFleet}>Open fleet roster <ArrowRight size={15}/></button>
        </div>
        <div className="at-rdash-filters">
          <label className="at-rdash-search"><Search size={15}/><input aria-label="Search vehicles or drivers"
            value={search} placeholder="Search vehicle or driver" onChange={e=>setSearch(e.target.value)}/></label>
          <select aria-label="Filter vehicle status" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">All statuses</option><option value="active">Active</option>
            <option value="idle">Idle</option><option value="unreported">Not reporting</option>
            <option value="disabled">Disabled</option>
            {isDemo&&<option value="maintenance-sample">Sample maintenance</option>}
          </select>
          <select aria-label="Sort vehicles" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="unit">Unit number</option>
            <option value="updated">Last reported</option>
            {isDemo&&<option value="score">Sample health score</option>}
          </select>
        </div>
        <div className="at-rdash-table-scroll">
          <table className="at-rdash-table"><thead><tr>
            <th>Vehicle</th><th>Driver</th><th>Reporting status</th>
            <th>{isDemo?'Sample health score':'Mechanical health'}</th><th>Last GPS update</th><th></th>
          </tr></thead><tbody>
          {displayed.map(row=><tr key={row.id}>
            <td><div className="at-rdash-vehicle"><span className="at-rdash-truck-icon"><Truck size={21}/></span>
              <div><strong>#{row.unitNumber}</strong><small>{row.type.replaceAll('_',' ')}</small></div></div></td>
            <td><span className="at-rdash-driver"><span className="at-rdash-avatar">{row.driverName[0]?.toUpperCase()||'—'}</span>
              {row.driverName}</span></td>
            <td><span className={'at-rdash-status '+row.state}><i/>{row.status}</span></td>
            <td>{row.healthScore==null?<span className="at-rdash-unknown">Not connected</span>:
              <div className="at-rdash-score"><strong>{row.healthScore}<small>/100</small></strong>
                <span><i style={{width:row.healthScore+'%',background:row.healthScore>=80?'#71bb31':row.healthScore>=60?'#f4bc40':'#fa7c30'}}/></span></div>}</td>
            <td><span className="at-rdash-muted">{fmtTime(row.lastUpdate,now)}</span></td>
            <td><button type="button" className="at-rdash-arrow" aria-label={'View details for '+row.unitNumber}
              onClick={()=>setFocused(row.id)}><ChevronRight size={19}/></button></td>
          </tr>)}
          {displayed.length===0&&<tr><td colSpan={6}><div className="at-rdash-empty">
            <Truck size={23}/>{rows.length?'No vehicles match these filters.':'No registered vehicles yet.'}</div></td></tr>}
          </tbody></table>
        </div>
        <div className="at-rdash-table-footer"><span>Showing {visible.length?safePage*6+1:0}–{Math.min(visible.length,(safePage+1)*6)} of {visible.length}</span>
          <div><button disabled={safePage<=0} onClick={()=>setPage(p=>Math.max(0,p-1))} aria-label="Previous fleet page"><ChevronLeft size={17}/></button>
            <span>Page {safePage+1} / {pageCount}</span>
            <button disabled={safePage>=pageCount-1} onClick={()=>setPage(p=>p+1)} aria-label="Next fleet page"><ChevronRight size={17}/></button>
          </div></div>
      </section>
      <aside className="at-rdash-fleet-aside">
        <section className="at-rdash-panel"><h3>Fleet Health Score</h3>
          <GaugeScore score={counts.averageSampleScore}/>
          <p className="at-rdash-explain">{isDemo?'Illustrative sensor score; not from real maintenance data.':
            'Vehicle diagnostic sensors and a validated maintenance scoring model are not connected.'}</p></section>
        <section className="at-rdash-panel"><h3>Health Score Breakdown</h3>
          {isDemo?<div className="at-rdash-breakdown">
            <div className="at-rdash-donut" style={{'--donut-degrees':(breakdown[0].count/Math.max(rows.length,1)*360)+'deg'}}/>
            <div>{breakdown.map((b,i)=><div className="at-rdash-legend" key={b.label}>
              <i style={{background:segments[i].color}}/><span>{b.label}</span><strong>{b.count}</strong></div>)}</div>
          </div>:<div className="at-rdash-unavailable"><Gauge size={27}/>
            <strong>No verified mechanical health scores</strong><span>The live fleet has operational and GPS status only.</span></div>}
        </section>
      </aside>
    </div>
    <div className="at-rdash-fleet-bottom">
      <section className="at-rdash-panel"><div className="at-rdash-section-title"><h3>Maintenance Alerts</h3>
        <span className="at-rdash-source-label">{isDemo?'SAMPLE ALERTS':'NOT CONNECTED'}</span></div>
        {isDemo? <div className="at-rdash-maint-list">{alerts.length?alerts.map(a=>
          <button key={a.id} type="button" onClick={()=>setFocused(a.id.split(':')[0])}>
            <span><Wrench size={16}/></span><div><strong>{a.title}</strong><small>{a.unit} · {a.detail}</small></div>
            <em>{a.severity==='high'?'High':'Medium'}</em><ChevronRight size={14}/>
          </button>):<p>No sample alerts in the selected demo fleet.</p>}</div>:
          <div className="at-rdash-unavailable"><Wrench size={24}/><strong>Maintenance feed not connected</strong>
            <span>Oil, tire, brake and engine diagnostics require a validated vehicle maintenance or telematics integration.</span></div>}
        <button type="button" className="at-rdash-text-button" onClick={onViewTracking}>View fleet reporting <ArrowRight size={14}/></button>
      </section>
      <section className="at-rdash-panel"><div className="at-rdash-section-title"><h3>Health Score Trend</h3>
        <span className="at-rdash-source-label">{isDemo?'SAMPLE TIMELINE':'HISTORY UNAVAILABLE'}</span></div>
        {isDemo?<DemoTrend/>:<div className="at-rdash-unavailable"><BarChart3 size={29}/>
          <strong>No diagnostic score history recorded</strong>
          <span>Trend lines require actual dated vehicle health assessments; live values are not fabricated.</span></div>}</section>
    </div>
    <div className="at-rdash-integrity"><ShieldCheck size={15}/>
      {isDemo?'Sample mode: all health scores, maintenance messages and historical trends are fictional.':
        'Live mode: assignment, vehicle and fresh GPS status only. No mechanical-health claims or fake maintenance alerts.'}</div>
    {selected&&<div className="at-rdash-dialog-overlay" onMouseDown={e=>{
      if(e.currentTarget===e.target)setFocused('');
    }}><div className="at-rdash-dialog" role="dialog" aria-modal="true"
      aria-label={'Vehicle detail '+selected.unitNumber}>
      <div className="at-rdash-section-title"><h3>Unit {selected.unitNumber}</h3>
        <button type="button" onClick={()=>setFocused('')} aria-label="Close vehicle detail"><X size={19}/></button></div>
      {[
        ['Equipment',selected.type],['Assigned driver',selected.driverName],
        ['Reported status',selected.status],['GPS updated',fmtTime(selected.lastUpdate,now)],
        ['Health',selected.healthScore==null?'Not connected':selected.healthScore+'/100 · SAMPLE ONLY'],
        ['Active shipment',selected.assignment?.reference||'No active load'],
      ].map(([label,value])=><div className="at-rdash-dialog-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      <p>{isDemo?'Sample diagnostic panel — not real vehicle telemetry.':
        'Mechanical health and maintenance alerts are not yet connected to this fleet.'}</p>
      <button type="button" className="at-rdash-primary" onClick={()=>{setFocused('');onViewFleet();}}>
        Go to vehicle roster <ArrowRight size={15}/></button>
    </div></div>}
  </div>;
}
