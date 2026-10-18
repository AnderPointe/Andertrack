import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Command, Database, Filter, LayoutDashboard, LockKeyhole,
  LogOut, MapPinned, Menu, Moon, Package, Radio, RefreshCw, Route, Search, Settings2,
  ShieldCheck, Sun, Truck, Users, Wifi, X, Zap, Sparkles, Download, Keyboard, History, HeartPulse,
} from 'lucide-react';
import FleetMap from './FleetMap.jsx';
import { ACTIVE_STATUSES, freshGpsPosition, visibleShipments, selectedVisibleShipment } from '../../lib/operations.js';
import { deriveOperationalAlerts, deriveActivityStream, shipmentCsv } from '../../lib/command-intelligence.js';
import { AlertList, AlertDrawer, CommandPalette } from './SmartOperations.jsx';
import './smart-operations.css';
import './command-center.css';
import DispatchRequestQueue from './DispatchRequestQueue.jsx';
import AssignmentActions from './AssignmentActions.jsx';
import DeliveryWorkflow from './DeliveryWorkflow.jsx';
import ShipmentJourney from './ShipmentJourney.jsx';
import FleetIntelligence from './FleetIntelligence.jsx';
import DispatchPlanner from './DispatchPlanner.jsx';
import DriverCockpit from './DriverCockpit.jsx';
import FleetHealthDashboard from './FleetHealthDashboard.jsx';
import DispatchModeDashboard from './DispatchModeDashboard.jsx';
import {WarehouseOperationsDashboard,DeliveryOverviewDashboard} from './ModernOperationsDashboards.jsx';
import DriverVehicleProfiles from './DriverVehicleProfiles.jsx';
import ClassCOpsDashboard from './ClassCOpsDashboard.jsx';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'delivery-overview', label: 'Delivery Overview', icon: Package },
  { id: 'warehouse', label: 'Warehouse Operations', icon: Truck },
  { id: 'class-c', label: 'Class C Fleet', icon: Truck },
  { id: 'tracking', label: 'Live tracking', icon: MapPinned },
  { id: 'intelligent-fleet', label: 'Fleet intelligence', icon: Radio },
  { id: 'fleet-health', label: 'Fleet Health', icon: HeartPulse },
  { id: 'driver-cockpit', label: 'Driver Cockpit & HOS', icon: HeartPulse },
  { id: 'dispatch', label: 'Dispatch center', icon: Route },
  { id: 'dispatch-mode', label: 'Dispatch Mode', icon: MapPinned },
  { id: 'dispatch-planner', label: 'Dispatch optimization', icon: Sparkles },
  { id: 'journeys', label: 'Shipment journeys', icon: History },
  { id: 'intelligence', label: 'Smart Operations', icon: Sparkles },
  { id: 'fleet', label: 'Drivers & fleet', icon: Truck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Workspace settings', icon: Settings2 },
];
const ACTIVE_STATES = ACTIVE_STATUSES;
const human = value => String(value || 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const stamp = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const statusTone = value => value === 'delivered' ? 'teal' :
  value === 'in_transit' || value === 'accepted' ? 'orange' :
  value === 'cancelled' ? 'negative' : 'neutral';

function StatusPill({ status }) {
  return <span className={'at-status-pill at-status-' + statusTone(status)}>
    <i />{human(status)}
  </span>;
}
function CardHeading({ eyebrow, title, action }) {
  return <div className="at-card-title">
    <div><span className="at-kicker">{eyebrow}</span><h2>{title}</h2></div>
    {action}
  </div>;
}
function MetricCard({ icon: Icon, label, value, detail, accent = 'orange' }) {
  return <article className={'at-metric at-metric-' + accent}>
    <div className="at-metric-top"><span>{label}</span><span className="at-metric-icon"><Icon size={18}/></span></div>
    <strong>{value}</strong><div className="at-metric-foot"><span className="at-metric-signal" />{detail}</div>
  </article>;
}
function ShipmentPanel({ assignments, selected, onSelect, filter, setFilter, query, onExport, embedded = false }) {
  const items = useMemo(() => visibleShipments(assignments,filter,query),[assignments,filter,query]);
  return <section className={'at-surface at-shipments ' + (embedded ? 'at-embedded' : '')}>
    <CardHeading eyebrow="SHIPMENT INTELLIGENCE" title="Active order pipeline" action={<div className="at-intel-quick-actions"><span className="at-count">{items.length} visible</span><button type="button" onClick={()=>onExport?.(items)} disabled={items.length===0} aria-label="Export visible shipments as CSV"><Download size={15}/> Export CSV</button></div>}/>
    <div className="at-filter-row" role="group" aria-label="Filter shipments">
      {[['all','All loads'],['active','In progress'],['pending','Awaiting'],['delivered','Delivered']].map(([id,label]) =>
        <button key={id} type="button" className={filter === id ? 'at-chip active' : 'at-chip'} onClick={() => setFilter(id)}>{label}</button>)}
    </div>
    <div className="at-table-wrap">
      <table className="at-orders-table">
        <thead><tr><th>LOAD ID / CUSTOMER</th><th>ROUTE</th><th>TYPE</th><th>STATUS</th><th></th></tr></thead>
        <tbody>{items.map(a => <tr key={a.id} className={selected?.id === a.id ? 'at-row-selected' : ''}
          onClick={() => onSelect(a.id)} onKeyDown={e => { if (e.key === 'Enter') onSelect(a.id); }}
          tabIndex={0} aria-label={'Inspect load ' + a.reference}>
          <td><b>{a.reference}</b><small>{a.customer_name}</small></td>
          <td><span className="at-route-cell">{a.pickup_address}<ArrowRight size={13}/>{a.dropoff_address}</span></td>
          <td>{a.division}</td><td><StatusPill status={a.status}/></td>
          <td><ChevronRight size={17}/></td>
        </tr>)}</tbody>
      </table>
      {items.length === 0 && <div className="at-empty-list"><Package size={28}/><strong>No matching shipments</strong><span>Live orders will appear here as your organization creates them.</span></div>}
    </div>
  </section>;
}
function ShipmentDetail({ active, driver, organizationId, role, currentUserId, profile, drivers, vehicles, reload, isDemo }) {
  return <section className="at-surface at-shipment-detail">
    <CardHeading eyebrow="SHIPMENT DETAILS" title={active ? active.reference : 'Select a load'}
      action={active && <StatusPill status={active.status}/>}/>
    {!active ? <div className="at-empty-list"><Package size={25}/><strong>No load selected</strong><span>Choose a shipment to inspect its route and assignment.</span></div> : <>
      <h3>{active.customer_name}</h3><p className="at-subtext">{active.commodity}</p>
      <div className="at-route-timeline">
        <div><span className="at-route-node at-node-start"/><div><small>PICKUP</small><strong>{active.pickup_address}</strong></div></div>
        <div className="at-route-spine" />
        <div><span className="at-route-node at-node-end"/><div><small>DELIVERY</small><strong>{active.dropoff_address}</strong></div></div>
      </div>
      <div className="at-details-grid">
        <div><small>Division</small><strong>{active.division}</strong></div>
        <div><small>Estimated distance</small><strong>{active.estimated_miles == null ? 'Not recorded' : active.estimated_miles + ' mi'}</strong></div>
        <div><small>Assigned driver</small><strong>{driver?.display_name || (active.driver_user_id ? 'Driver assigned' : 'Unassigned')}</strong></div>
        <div><small>Created</small><strong>{stamp(active.created_at)}</strong></div>
      </div>
      {!isDemo ? <>
        <AssignmentActions assignment={active} role={role} currentUserId={currentUserId}
          profile={profile} drivers={drivers} vehicles={vehicles} onChanged={reload}/>
        <DeliveryWorkflow key={organizationId + ':' + active.id} assignment={active}
          organizationId={organizationId} currentUserId={currentUserId}
          role={role} profile={profile} onChanged={reload}/>
        <ShipmentJourney key={'journey:' + organizationId + ':' + currentUserId + ':' + active.id}
          assignment={active} organizationId={organizationId}
          currentUserId={currentUserId} role={role} compact/>
      </> : <><DeliveryWorkflow isDemo assignment={active} organizationId="demo-only" currentUserId="demo-only" role="admin" profile={null}/>
        <ShipmentJourney isDemo assignment={active} organizationId="demo-only" currentUserId="demo-only" role="admin" compact/></>}
    </>}
  </section>;
}
function PerformancePanel({ assignments, drivers }) {
  const total = assignments.length;
  const delivered = assignments.filter(a => a.status === 'delivered').length;
  const active = assignments.filter(a => ACTIVE_STATES.has(a.status)).length;
  const pending = assignments.filter(a => ['unassigned', 'offered'].includes(a.status)).length;
  const a = total ? delivered / total * 100 : 0;
  const b = total ? active / total * 100 : 0;
  return <section className="at-surface at-performance">
    <CardHeading eyebrow="OPERATIONS SNAPSHOT" title="Fleet performance"/>
    <div className="at-performance-inner">
      <div className="at-donut" style={{background: 'conic-gradient(var(--at-teal) 0% ' + a + '%, var(--at-orange) ' + a + '% ' + (a+b) + '%, var(--at-track) ' + (a+b) + '% 100%)'}}>
        <div><strong>{total}</strong><span>total loads</span></div>
      </div>
      <div className="at-performance-legend">
        <div><i className="teal"/><span>Delivered</span><strong>{delivered}</strong></div>
        <div><i className="orange"/><span>Active</span><strong>{active}</strong></div>
        <div><i className="muted"/><span>Waiting / other</span><strong>{total - delivered - active}</strong></div>
        <div className="at-performance-divider"/>
        <div><Users size={15}/><span>Available drivers</span><strong>{drivers.filter(d => d.availability === 'available').length}</strong></div>
      </div>
    </div>
    <p className="at-fine-print">Based on visible organization records. This chart is not an on-time delivery or compliance score.</p>
  </section>;
}
function ActivityBars({ assignments }) {
  const days = useMemo(() => Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i));
    const next = new Date(d); next.setDate(d.getDate()+1);
    return { key:d.toLocaleDateString(undefined,{weekday:'short'}), total:assignments.filter(a => {
      const ts=Date.parse(a.created_at); return ts >= +d && ts < +next;
    }).length };
  }), [assignments]);
  const max = Math.max(1, ...days.map(x=>x.total));
  return <section className="at-surface at-activity">
    <CardHeading eyebrow="LAST 7 DAYS" title="Shipment activity" action={<span className="at-count">Created loads</span>}/>
    <div className="at-bars">{days.map((day,index) => <div key={index} className="at-bar-col">
      <span className="at-bar-count">{day.total || ''}</span>
      <div className="at-bar-track"><div className="at-bar-fill" style={{height:(day.total ? Math.max(9, day.total/max*100) : 3)+'%'}}/></div>
      <span className="at-bar-label">{day.key}</span>
    </div>)}</div>
    <div className="at-chart-footer"><Activity size={15}/> Actual shipment creation timestamps · No estimates</div>
  </section>;
}
function TrackingPanel({ locations, theme, drivers, isDemo, onChoose, scopeKey }) {
  const fresh = locations.filter(l => freshGpsPosition(l));
  return <section className="at-surface at-tracking-panel">
    <CardHeading eyebrow="GEOSPATIAL COMMAND" title="Live fleet tracking" action={<span className="at-live-chip"><Radio size={14}/>{fresh.length} reporting</span>}/>
    <div className="at-map-frame"><FleetMap key={scopeKey} locations={locations} theme={theme} onChoose={onChoose}/>
      <div className="at-map-top-left"><span className="at-map-overlay-label"><span/> {isDemo ? 'ILLUSTRATIVE DEMO POSITIONS' : 'AUTHORIZED GPS POSITIONS'}</span></div>
      <div className="at-map-bottom-left"><div><strong>{locations.length}</strong><small>Location records</small></div>
        <div><strong>{fresh.length}</strong><small>Reporting in 5 min</small></div></div>
    </div>
  </section>;
}
function FleetPanel({ drivers, vehicles, locations }) {
  return <div className="at-fleet-layout">
    <section className="at-surface"><CardHeading eyebrow="PERSONNEL" title="Driver roster" action={<span className="at-count">{drivers.length} drivers</span>}/>
      <div className="at-people-list">{drivers.map(d => <div className="at-person" key={d.id || d.user_id}>
        <span className="at-person-avatar"><Truck size={17}/></span>
        <div><strong>{d.display_name}</strong><small>License class {d.license_class} · {d.license_verified ? 'Verified' : 'Verification pending'}</small></div>
        <span className={'at-status-pill at-status-'+(d.availability==='available'?'teal':'neutral')}><i/>{human(d.availability)}</span>
      </div>)}
      {drivers.length === 0 && <div className="at-empty-list"><Users size={25}/><strong>No drivers onboarded</strong><span>Driver profiles will appear here once your organization enrolls them.</span></div>}</div>
    </section>
    <section className="at-surface"><CardHeading eyebrow="EQUIPMENT" title="Fleet inventory" action={<span className="at-count">{vehicles.length} vehicles</span>}/>
      <div className="at-vehicle-list">{vehicles.map(v=><div className="at-vehicle" key={v.id}>
        <div className="at-vehicle-icon"><Truck size={24}/></div>
        <div><strong>{v.unit_number}</strong><small>{human(v.vehicle_type)} · Class {v.required_license_class}</small></div>
        <span className={'at-status-pill at-status-'+(v.enabled?'teal':'neutral')}><i/>{v.enabled?'Enabled':'Disabled'}</span>
      </div>)}
      {vehicles.length === 0 && <div className="at-empty-list"><Truck size={25}/><strong>No equipment registered</strong><span>Fleet assets will appear here once onboarding is complete.</span></div>}</div>
    </section>
  </div>;
}

export default function OpsCommandCenter({
  isDemo=false, session, memberships=[], membershipLoaded=true, organizationId, setOrganizationId=()=>{}, role='',
  profile, assignments=[], dispatchRequests=[], drivers=[], vehicles=[], locations=[], error='',
  loading=false, sync='Not connected', reload=()=>{}, onDemo=()=>{}, onSignOut=()=>{},
}) {
  const [view,setView]=useState(isDemo?'delivery-overview':'overview');
  const [theme,setTheme]=useState(() => { try { return localStorage.getItem('andertrack_ui_theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  useEffect(() => { try { localStorage.setItem('andertrack_ui_theme',theme); } catch { /* Storage may be unavailable. */ } },[theme]);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [selectedId,setSelectedId]=useState('');
  const [mobileMenu,setMobileMenu]=useState(false);
  const [focusedPin,setFocusedPin]=useState(null);
  const [alertDrawerOpen,setAlertDrawerOpen]=useState(false);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [clock,setClock]=useState(()=>Date.now());
  const [snoozes,setSnoozes]=useState(()=>{try{return JSON.parse(localStorage.getItem('andertrack_alert_snoozes')||'{}');}catch{return {};}});
  const ordered = useMemo(()=>[...assignments].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)),[assignments]);
  const visible = useMemo(() => visibleShipments(ordered,filter,query),[ordered,filter,query]);
  const selected=selectedVisibleShipment(visible,selectedId);
  const currentDriver=drivers.find(d=>d.user_id===selected?.driver_user_id);
  const userId=session?.user?.id||'';
  const planner=role==='admin'||role==='dispatcher';
  const onChoose = location => setFocusedPin(location);
  const open = page=>{setView(page);setMobileMenu(false);};
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),30_000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const handle=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();setPaletteOpen(value=>!value);
    }};
    window.addEventListener('keydown',handle);
    return ()=>window.removeEventListener('keydown',handle);
  },[]);
  const total=ordered.length, active=ordered.filter(a=>ACTIVE_STATES.has(a.status)).length;
  const enRoute=ordered.filter(a=>a.status==='in_transit').length;
  const delivered=ordered.filter(a=>a.status==='delivered').length;
  const available=drivers.filter(d=>d.availability==='available').length;
  const fresh=locations.filter(l=>freshGpsPosition(l)).length;
  const alerts=useMemo(()=>deriveOperationalAlerts({assignments:ordered,requests:dispatchRequests,drivers,locations,planner:planner||isDemo,userId},clock),
    [ordered,dispatchRequests,drivers,locations,planner,isDemo,userId,clock]);
  const activity=useMemo(()=>deriveActivityStream({assignments:ordered,requests:dispatchRequests,locations,planner:planner||isDemo,userId},clock),
    [ordered,dispatchRequests,locations,planner,isDemo,userId,clock]);
  const scopedSnoozes=useMemo(()=>Object.fromEntries(Object.entries(snoozes).filter(([key])=>key.startsWith(organizationId+':'))
    .map(([key,value])=>[key.slice(organizationId.length+1),value])),[snoozes,organizationId]);
  const activeAlerts=alerts.filter(a=>!scopedSnoozes[a.id]||Number(scopedSnoozes[a.id])<=clock);
  const changeSnooze=(id,until)=>setSnoozes(previous=>{
    const next={...previous}; const key=organizationId+':'+id;
    if(until)next[key]=until;else delete next[key];
    try{localStorage.setItem('andertrack_alert_snoozes',JSON.stringify(next));}catch{/* private browsing */}
    return next;
  });
  const onSnooze=id=>changeSnooze(id,Date.now()+30*60_000);
  const onRestore=id=>changeSnooze(id,0);
  const goToItem=item=>{
    setQuery('');setFilter('all');
    if(item.assignmentId)setSelectedId(item.assignmentId);
    open(item.view||'overview');
  };
  const exportShipments=items=>{
    const csv=shipmentCsv(items);
    const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const element=document.createElement('a');
    element.href=url;element.download='andertrack-shipments-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(element);element.click();element.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  const metrics=[
    {label:'Total shipments',value:total,detail:'Visible to your organization',icon:Package,accent:'orange'},
    {label:'Active deliveries',value:active,detail:enRoute+' currently in transit',icon:Route,accent:'teal'},
    {label:'Drivers available',value:available,detail:drivers.length+' drivers on roster',icon:Users,accent:'orange'},
    {label:'Pending requests',value:dispatchRequests.length,detail:delivered+' loads delivered',icon:Clock3,accent:'teal'},
  ];
  const noMembership=!isDemo && membershipLoaded && memberships.length===0;
  const noDriver=!isDemo && !planner && !profile;
  return <div className="at-workspace" data-theme={theme}>
    <aside className={'at-sidebar '+(mobileMenu?'at-sidebar-open':'')}>
      <div className="at-brand-area"><div className="at-brandmark"><Route size={23}/></div>
        <div><strong>ANDER<span>TRACK</span></strong><small>LOGISTICS INTELLIGENCE</small></div>
        <button className="at-mobile-close" onClick={()=>setMobileMenu(false)} aria-label="Close navigation"><X size={19}/></button>
      </div>
      <div className="at-workspace-switch"><div className="at-org-monogram">A</div><div><strong>AnderPointe</strong><small>{isDemo?'Demo workspace':human(role)+' workspace'}</small></div><ChevronRight size={16}/></div>
      <div className="at-nav-section">WORKSPACE</div>
      <nav className="at-side-nav" aria-label="Command center navigation">{NAV.map(({id,label,icon:Icon})=>
        <button key={id} onClick={()=>open(id)} className={'at-nav-item '+(view===id?'at-nav-active':'')} aria-current={view===id?'page':undefined}>
          <Icon size={19}/><span>{label}</span>{id==='dispatch'&&dispatchRequests.length>0&&<em>{dispatchRequests.length}</em>}
        </button>)}</nav>
      <div className="at-sidebar-bottom">
        <div className="at-signal-card"><span className="at-signal-graphic"><Radio size={20}/></span>
          <div><strong>Operations network</strong><small>{isDemo?'Sample data · offline':sync}</small></div>
          <span className={'at-connection-light '+(sync==='Realtime connected'?'connected':'')}/></div>
        <button className="at-nav-item at-help" onClick={()=>open('settings')}><CircleHelp size={18}/><span>Help & security</span></button>
        <div className="at-side-footer">ANDERTRACK OS <span>•</span> V2 DESIGN</div>
      </div>
    </aside>
    {mobileMenu&&<button className="at-mobile-overlay" onClick={()=>setMobileMenu(false)} aria-label="Close navigation"/>}
    <div className="at-main-shell">
      <header className="at-topbar">
        <div className="at-topbar-left">
          <button className="at-icon-button at-mobile-menu" onClick={()=>setMobileMenu(true)} aria-label="Open navigation"><Menu size={21}/></button>
          <span className="at-breadcrumb">WORKSPACE</span><ChevronRight size={14}/><strong>{NAV.find(n=>n.id===view)?.label}</strong>
        </div>
        <div className="at-topbar-actions">
          <label className="at-global-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())open('dispatch');}}
            placeholder="Search loads, locations, customers..." aria-label="Search shipments"/></label>
          <button className="at-icon-button at-alert-shortcut" onClick={()=>setPaletteOpen(true)} title="Command palette (Ctrl/⌘+K)" aria-label="Open command palette"><Keyboard size={19}/></button>
          <button className={'at-icon-button at-alert-shortcut '+(activeAlerts.length?'has-alerts':'')} onClick={()=>setAlertDrawerOpen(true)} title="Review operational alerts" aria-label="Review operational alerts"><Bell size={19}/>{activeAlerts.length>0&&<span className="at-notification-count">{activeAlerts.length}</span>}</button>
          <button className="at-icon-button" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} title="Toggle light/dark appearance"
            aria-label="Toggle theme">{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button>
          <button className="at-icon-button" onClick={reload} disabled={loading} title="Refresh operational data" aria-label="Refresh data"><RefreshCw size={18} className={loading?'at-spinning':''}/></button>
          <span className="at-account-avatar" title={session?.user?.email||'Demo account'}>{(session?.user?.email?.[0]||'A').toUpperCase()}</span>
        </div>
      </header>
      <main className="at-content">
        <section className="at-page-heading">
          <div><div className="at-eyebrow"><span className="at-eyebrow-bar"/>ANDERTRACK / {isDemo?'INTERACTIVE DEMO':'SECURE OPERATIONS'}</div>
            <h1>{view==='overview'?'Operations at a glance':NAV.find(n=>n.id===view)?.label}</h1>
            <p>{view==='overview'?'Everything moving, everyone connected. One command center.':
              view==='tracking'?'Real-time fleet visibility, location history and live operational context.':
              view==='warehouse'?'A bright equipment staging and warehouse operations view, linked to real shipment records.':
              view==='class-c'?'Local non-CDL fleet operations, vehicle health readiness and sample maintenance planning.':
              view==='delivery-overview'?'A modern overview of completed shipments, delivery activity and vehicle selection.':
              view==='driver-cockpit'?'Authorized driver delivery controls and transparent ELD, payroll and telemetry integration readiness.':
              view==='intelligent-fleet'?'Replay recorded GPS traces, review telemetry quality and inspect local monitoring zones.':
              view==='dispatch'?'Manage the waiting line, plan assignments and follow every load.':
              view==='dispatch-mode'?'Track selected shipments, review fleet positions and dispatch communication readiness.':
              view==='fleet-health'?'Operational vehicle readiness, GPS reporting and maintenance integration status.':
              view==='dispatch-planner'?'Screen eligible driver and equipment matches while preserving FIFO priority.':
              view==='journeys'?'Trace recorded load transitions, package scans and private delivery confirmation.':
              view==='fleet'?'Verified people and ready equipment, side by side.':
              view==='analytics'?'Operational trends based on actual records, never estimated activity.':
              view==='intelligence'?'Live operational signals, quick triage and verifiable recent activity.':
              'Workspace controls, session security and source transparency.'}</p>
          </div>
          <div className="at-heading-actions">
            <span className={'at-live-chip '+(isDemo?'demo':'')}><span className="at-pulsing-dot"/>{isDemo?'SAMPLE DATA':'LIVE WORKSPACE'}</span>
            <button className="at-button at-button-primary" onClick={()=>open(planner||isDemo?'dispatch':'tracking')}>
              {planner||isDemo?'Open dispatch':'Track my work'} <ArrowUpRight size={17}/></button>
          </div>
        </section>
        {error&&<div className="at-alert" role="alert"><ShieldCheck size={17}/>{error}</div>}
        {!isDemo && !membershipLoaded ? <section className="at-surface at-access-needed" role="status"><RefreshCw size={26} className="at-spinning"/><h2>Checking workspace access</h2><p>Loading approved organizations and roles…</p></section> : noMembership?<section className="at-surface at-access-needed"><LockKeyhole size={30}/><h2>Organization access pending</h2>
          <p>A trusted administrator must assign your account to an organization. No customer or shipment data is exposed until access is approved.</p></section>:
        <>
          {!isDemo&&memberships.length>1&&<div className="at-org-select"><label htmlFor="at-org">Active organization</label><select id="at-org" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>{memberships.map(m=>
            <option key={m.organization_id} value={m.organization_id}>{m.organization_id.slice(0,8)} · {m.role}</option>)}</select></div>}
          {noDriver&&<div className="at-alert"><LockKeyhole size={18}/> Driver onboarding incomplete. Your organization must create a profile and verify your license before assignments and queue requests are available.</div>}
          {view==='overview'&&<>
            <div className="at-metrics-grid">{metrics.map(m=><MetricCard key={m.label} {...m}/>)}</div>
            <div className="at-hero-grid">
              <TrackingPanel locations={locations} theme={theme} isDemo={isDemo} drivers={drivers} onChoose={onChoose} scopeKey={organizationId}/>
              {isDemo?<section className="at-surface at-queue-placeholder">
                <CardHeading eyebrow="DISPATCH WORKFLOW" title="Live Request Queue" action={<span className="at-count">3 sample requests</span>}/>
                <div className="at-demo-request"><span>01</span><div><strong>Marcus Taylor</strong><small>CDL · Class A / Ready</small></div><i>FIRST</i></div>
                <div className="at-demo-request"><span>02</span><div><strong>Alex Rivera</strong><small>Class C · Cargo van</small></div></div>
                <div className="at-demo-request"><span>03</span><div><strong>Jordan Lee</strong><small>CDL · Class B / Ready</small></div></div>
                <button className="at-button at-button-primary at-wide" onClick={()=>open('dispatch')}>Explore dispatch <ArrowRight size={16}/></button>
                <div className="at-demo-note"><ShieldCheck size={15}/> Sample requests, no database writes.</div>
              </section>:<DispatchRequestQueue organizationId={organizationId} role={role} currentUserId={userId}
                profile={profile} requests={dispatchRequests} drivers={drivers} assignments={assignments}
                vehicles={vehicles} onChanged={reload}/>}
            </div>
            <div className="at-bottom-grid">
              <ShipmentPanel assignments={ordered} selected={selected} onSelect={setSelectedId} filter={filter} setFilter={setFilter} query={query} onExport={exportShipments}/>
              <PerformancePanel assignments={ordered} drivers={drivers}/>
            </div>
            <div className="at-overview-intelligence"><AlertList alerts={alerts} activity={activity} snoozes={scopedSnoozes} onNavigate={goToItem}
                onSnooze={onSnooze} onRestore={onRestore} isDemo={isDemo} heading="Smart Operations"/>
              <section className="at-surface at-intel-guide"><Sparkles size={28}/><span className="at-kicker">OPERATIONS SUPERPOWERS</span>
                <h3>Act before a small issue becomes a bottleneck.</h3><p>Find aging requests, stale vehicle reports and loads needing attention using auditable rules. No fictional predictions.</p>
                <p><kbd>Ctrl / ⌘</kbd> + <kbd>K</kbd> to search loads, drivers and pages instantly.</p>
                <button type="button" className="at-button at-button-primary" onClick={()=>open('intelligence')}>Open Smart Operations <ArrowRight size={16}/></button>
              </section></div>
            <div className="at-detail-bottom"><ShipmentDetail active={selected} driver={currentDriver} role={role}
              organizationId={organizationId} currentUserId={userId} profile={profile} drivers={drivers} vehicles={vehicles} reload={reload} isDemo={isDemo}/></div>
          </>}
          {view==='intelligence'&&<><div className="at-intel-quick-actions">
            <button type="button" onClick={()=>setPaletteOpen(true)}><Keyboard size={16}/> Open command palette</button>
            <button type="button" onClick={()=>open('dispatch')}><Route size={16}/> Dispatch center</button>
            <button type="button" onClick={reload} disabled={loading}><RefreshCw size={16}/> Refresh operational signals</button>
          </div><AlertList showAll alerts={alerts} activity={activity} snoozes={scopedSnoozes} onNavigate={goToItem}
            onSnooze={onSnooze} onRestore={onRestore} isDemo={isDemo} heading="Operational intelligence"/></>}
          {view==='tracking'&&<>
            <div className="at-tracking-stats">
              <MetricCard icon={Radio} label="GPS reporters" value={fresh} detail="Pings in the last 5 minutes" accent="teal"/>
              <MetricCard icon={Truck} label="Registered vehicles" value={vehicles.length} detail="Organization fleet" accent="orange"/>
              <MetricCard icon={Route} label="In transit" value={enRoute} detail="Assignment status" accent="teal"/>
            </div>
            <TrackingPanel locations={locations} theme={theme} isDemo={isDemo} drivers={drivers} onChoose={onChoose} scopeKey={organizationId}/>
            <div className="at-surface at-telemetry-list"><CardHeading eyebrow="LOCATION FEED" title="Fleet reporting" action={<span className="at-count">{locations.length} positions</span>}/>
              {locations.length?locations.map((l,index)=><button key={l.id||index} className="at-telemetry-row" onClick={()=>setFocusedPin(l)}>
                <span className="at-telemetry-icon"><Truck size={17}/></span><div><strong>{l.unit_number||l.display_name||'Fleet unit'}</strong><small>{human(l.status)} · {l.latitude}, {l.longitude}</small></div>
                <span className="at-count">{l.last_ping_at?new Date(l.last_ping_at).toLocaleTimeString():'No timestamp'}</span>
              </button>):<div className="at-empty-list"><Radio size={24}/><strong>No GPS records available</strong><span>Location markers are displayed only for authorized, reported positions.</span></div>}
            </div>
          </>}
          {view==='driver-cockpit'&&<DriverCockpit
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            assignments={ordered} drivers={drivers} vehicles={vehicles} locations={locations}
            organizationId={organizationId} currentUserId={userId} role={role}
            profile={profile} reload={reload} isDemo={isDemo}/>}
          {view==='dispatch-planner'&&<DispatchPlanner
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            assignments={ordered} drivers={drivers} vehicles={vehicles} locations={locations}
            requests={dispatchRequests} organizationId={organizationId} role={role} isDemo={isDemo}
            onOpenDispatch={()=>open('dispatch')}
            onReviewLoad={id=>{setSelectedId(id);setQuery('');setFilter('all');open('dispatch');}}/>}
          {view==='dispatch'&&<div className="at-dispatch-grid">
            <div>{isDemo?<section className="at-surface"><CardHeading eyebrow="QUEUE / DEMONSTRATION" title="First-in first-out"/>
              <p className="at-subtext">Phase 5 processes queue requests in database order. Connect authorized driver accounts to test the live queue.</p>
              <div className="at-demo-request"><span>01</span><div><strong>Marcus Taylor</strong><small>Waiting for dispatcher</small></div><i>FIRST</i></div>
              <div className="at-demo-request"><span>02</span><div><strong>Alex Rivera</strong><small>Waiting for dispatcher</small></div></div>
              <div className="at-demo-note"><LockKeyhole size={15}/> Demo only — claim controls disabled.</div></section>:
              <DispatchRequestQueue organizationId={organizationId} role={role} currentUserId={userId} profile={profile}
                requests={dispatchRequests} drivers={drivers} assignments={assignments} vehicles={vehicles} onChanged={reload}/>}
              <ShipmentPanel assignments={ordered} selected={selected} onSelect={setSelectedId} filter={filter} setFilter={setFilter} query={query} onExport={exportShipments}/>
            </div>
            <ShipmentDetail active={selected} driver={currentDriver} role={role} organizationId={organizationId}
              currentUserId={userId} profile={profile} drivers={drivers} vehicles={vehicles} reload={reload} isDemo={isDemo}/>
          </div>}
          {view==='class-c'&&<ClassCOpsDashboard
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            isDemo={isDemo} role={role} currentUserId={userId} organizationId={organizationId}
            vehicles={vehicles} assignments={ordered} drivers={drivers}
            locations={locations} onOpenDispatch={()=>open('dispatch')}/>}
          {view==='warehouse'&&<WarehouseOperationsDashboard
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            vehicles={vehicles} drivers={drivers} assignments={ordered} isDemo={isDemo} role={role}
            onOpenDispatch={()=>open('dispatch')} onOpenFleet={()=>open('fleet')}/>}
          {view==='delivery-overview'&&<DeliveryOverviewDashboard
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            assignments={ordered} vehicles={vehicles} drivers={drivers} isDemo={isDemo} role={role}
            onOpenDispatch={()=>open('dispatch')} onOpenFleet={()=>open('fleet')}
            onReviewLoad={id=>{setSelectedId(id);setQuery('');setFilter('all');open('dispatch');}}/>}
          {view==='fleet-health'&&<FleetHealthDashboard
            key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            vehicles={vehicles} drivers={drivers} assignments={ordered} locations={locations}
            now={clock} role={role} isDemo={isDemo}
            onViewFleet={()=>open('fleet')} onViewTracking={()=>open('tracking')}/>}
          {view==='dispatch-mode'&&<>
            <DispatchModeDashboard
              key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
              assignments={ordered} drivers={drivers} vehicles={vehicles} locations={locations}
              role={role} isDemo={isDemo} organizationId={organizationId}
              onReviewLoad={id=>{setSelectedId(id);setQuery('');setFilter('all');open('dispatch');}}
              onOpenQueue={()=>open('dispatch')} onOpenFleet={()=>open('fleet')}/>
            {(planner||isDemo)&&<DriverVehicleProfiles
              drivers={drivers} vehicles={vehicles} assignments={ordered} isDemo={isDemo}/>}
          </>}
          {view==='intelligent-fleet'&&<FleetIntelligence key={organizationId+':'+userId+':'+(isDemo?'demo':'live')}
            locations={locations} role={role} organizationId={organizationId} currentUserId={userId}
            isDemo={isDemo}/>}
          {view==='journeys'&&<div className="at-journey-page">
            <ShipmentPanel assignments={ordered} selected={selected} onSelect={setSelectedId} filter={filter}
              setFilter={setFilter} query={query} onExport={exportShipments}/>
            {selected ? <ShipmentJourney key={'control:' + organizationId + ':' + userId + ':' + selected.id}
              assignment={selected} organizationId={organizationId} currentUserId={userId}
              role={role} isDemo={isDemo}/> : <section className="at-surface at-empty-list">
                <Package size={26}/><strong>Select a shipment</strong><span>Choose a visible load to inspect its recorded lifecycle.</span>
              </section>}
          </div>}
          {view==='fleet'&&<FleetPanel drivers={drivers} vehicles={vehicles} locations={locations}/>}
          {view==='analytics'&&<>
            <div className="at-metrics-grid">{metrics.map(m=><MetricCard key={m.label} {...m}/>)}</div>
            <div className="at-analytics-grid"><ActivityBars assignments={ordered}/><PerformancePanel assignments={ordered} drivers={drivers}/></div>
          </>}
          {view==='settings'&&<div className="at-settings-grid">
            <section className="at-surface"><CardHeading eyebrow="PREFERENCES" title="Appearance & access"/>
              <div className="at-setting-line"><div><strong>Color mode</strong><small>Switch between dark operations mode and bright workspace.</small></div>
                <button className="at-button at-button-muted" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>} {theme==='dark'?'Use light mode':'Use dark mode'}</button></div>
              <div className="at-setting-line"><div><strong>Account</strong><small>{session?.user?.email||'Interactive demo visitor'} · {human(role)}</small></div></div>
              <div className="at-setting-line"><div><strong>Realtime status</strong><small>{isDemo?'Demo does not connect to your database.':sync}</small></div><Wifi size={19}/></div>
              <button className="at-button at-button-outline" onClick={isDemo?onDemo:onSignOut}><LogOut size={16}/>{isDemo?'Return to sign in':'Sign out securely'}</button>
            </section>
            <section className="at-surface"><CardHeading eyebrow="TRUST & SECURITY" title="Operational integrity"/>
              <div className="at-security-row"><ShieldCheck size={20}/><div><strong>Organization-restricted data</strong><p>Realtime rows and assignment actions use server-side authorization, not UI-only checks.</p></div></div>
              <div className="at-security-row"><Database size={20}/><div><strong>Live records, no invented telemetry</strong><p>Fleet positions and KPI counts come from database rows. Preview sample content is always labeled.</p></div></div>
              <div className="at-security-row"><Zap size={20}/><div><strong>Controlled dispatch workflow</strong><p>FIFO queue claims and load changes execute through protected Supabase RPCs.</p></div></div>
            </section>
          </div>}
        </>}
        <AlertDrawer open={alertDrawerOpen} alerts={alerts} activity={activity} snoozes={scopedSnoozes} onNavigate={goToItem}
          onSnooze={onSnooze} onRestore={onRestore} onClose={()=>setAlertDrawerOpen(false)} isDemo={isDemo}/>
        <CommandPalette open={paletteOpen} onClose={()=>setPaletteOpen(false)} onNavigate={goToItem} assignments={ordered} drivers={drivers} pages={NAV}/>
        {focusedPin&&<div className="at-floating-detail" role="status"><Truck size={19}/><div><strong>{focusedPin.unit_number||focusedPin.display_name||'Fleet unit'}</strong>
          <small>{human(focusedPin.status)} · Last ping {focusedPin.last_ping_at?new Date(focusedPin.last_ping_at).toLocaleString():'unknown'}</small></div>
          <button onClick={()=>setFocusedPin(null)} aria-label="Dismiss fleet detail"><X size={17}/></button></div>}
        <footer className="at-footer"><span>© ANDERTRACK · OPERATIONS INTELLIGENCE</span><span>{isDemo?'Interactive preview · sample data only':'Protected workspace · role-based access'}</span></footer>
      </main>
    </div>
  </div>;
}
