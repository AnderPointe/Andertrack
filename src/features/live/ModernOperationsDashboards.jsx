import React,{useMemo,useState} from 'react';
import {
  Activity,ArrowRight,BarChart3,Box,CheckCircle2,ChevronRight,Clock3,
  Filter,Grid2X2,List,MapPinned,Package,Plus,Search,ShieldCheck,Truck,
  Users,Warehouse,X,
} from 'lucide-react';
import Vehicle3D from './Vehicle3D.jsx';
import {warehouseCards,warehouseCounts,shipmentDashboardCounts,shipmentActivityByDay}
  from '../../lib/modern-operations.js';
import './modern-operations.css';

function CardKpi({icon:Icon,label,value,meta=''}){
  return <div className="at-modern-kpi"><div><Icon size={16}/><span>{label}</span></div>
    <strong>{value}</strong><small>{meta}</small></div>;
}
function Empty({message}){return <div className="at-modern-empty"><Truck size={28}/>
  <strong>{message}</strong><p>Details appear as authorized equipment and shipments are added.</p></div>;}
function Tag({status}) {
  const good=['Ready','delivered'].includes(status);
  const caution=['Assigned','in_transit','picked_up','accepted'].includes(status);
  return <span className={'at-modern-tag '+(good?'ready':caution?'ongoing':'pending')}>
    <i/>{String(status||'Unknown').replaceAll('_',' ')}</span>;
}

export function WarehouseOperationsDashboard({
  vehicles=[],assignments=[],drivers=[],isDemo=false,role='',
  onOpenDispatch=()=>{},onOpenFleet=()=>{},
}) {
  const planner=role==='admin'||role==='dispatcher'||isDemo;
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
  const [layout,setLayout]=useState('grid'),[focused,setFocused]=useState('');
  const cards=useMemo(()=>warehouseCards({vehicles,assignments,drivers,isDemo}),
    [vehicles,assignments,drivers,isDemo]);
  const counts=warehouseCounts(cards,assignments);
  const filtered=cards.filter(item=>
    (filter==='all'||filter.toLowerCase()===item.state.toLowerCase()) &&
    [item.display.unit,item.display.title,item.driver?.display_name,item.route]
      .join(' ').toLowerCase().includes(search.toLowerCase().trim()));
  const active=cards.find(c=>c.id===focused)||null;
  if(!planner)return <div className="at-modern at-modern-empty"><ShieldCheck size={24}/>
    <strong>Warehouse Operations requires dispatcher access.</strong></div>;
  return <div className="at-modern">
    <header className="at-modern-header"><div className="at-modern-brand"><span><Warehouse size={21}/></span>
      <div><small>HORIZON-INSPIRED OPERATIONS / ANDERTRACK</small>
        <h2>Warehouse operations</h2><p>Track equipment readiness and authorized shipment assignments in a bright, streamlined workspace.</p></div>
    </div><div className="at-modern-header-actions"><span className="at-modern-pill">
      <Activity size={14}/>{isDemo?'SAMPLE WORKSPACE':'LIVE RECORDS'}</span>
      <button onClick={onOpenDispatch} className="at-modern-primary"><Plus size={17}/> Quick shipment</button>
    </div></header>
    <section className="at-modern-overview">
      <div className="at-modern-section-title"><h3>Warehouse overview</h3>
        <span>{isDemo?'Illustrative equipment readiness':'Live registered equipment / assigned shipments'}</span></div>
      <div className="at-modern-kpis">
        <CardKpi icon={Truck} label="Registered vehicles" value={counts.registered} meta="Fleet inventory"/>
        <CardKpi icon={Package} label="Unassigned shipments" value={counts.unassignedShipments} meta="Awaiting dispatch"/>
        <CardKpi icon={Activity} label="Equipment assigned" value={counts.assigned} meta="Active shipments linked to unit"/>
        <CardKpi icon={CheckCircle2} label="Vehicles ready" value={counts.ready} meta="Enabled with no active load"/>
      </div>
      <p className="at-modern-live-disclaimer"><ShieldCheck size={14}/>
        Warehouse dock occupancy, loaded kilograms and physical loading progress are not recorded by the current database.</p>
    </section>
    <section className="at-modern-warehouse">
      <div className="at-modern-section-title"><div><h3>Vehicles in operations</h3>
        <p>Select any card to inspect its assigned driver and explore a rotatable vehicle in 3D.</p></div>
      <div className="at-modern-toolbar"><label><Search size={15}/>
        <input placeholder="Search truck, driver or route" value={search} onChange={e=>setSearch(e.target.value)}
          aria-label="Search warehouse vehicles"/></label>
        <select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter warehouse vehicles">
          <option value="all">All units</option><option value="Assigned">Assigned</option>
          <option value="Ready">Ready</option><option value="Unavailable">Unavailable</option>
        </select>
        <button aria-label="Grid layout" aria-pressed={layout==='grid'}
          onClick={()=>setLayout('grid')}><Grid2X2 size={16}/></button>
        <button aria-label="List layout" aria-pressed={layout==='list'}
          onClick={()=>setLayout('list')}><List size={16}/></button>
      </div></div>
      <div className={'at-modern-card-grid '+(layout==='list'?'list':'')}>
        {filtered.map(({id,vehicle,display,state,driver,route,sampleProgress})=>
          <button key={id} className="at-modern-truck-card" onClick={()=>setFocused(id)}>
            <div className="at-modern-card-image"><Tag status={state}/>
              <div className="at-modern-truck-art"><Truck size={94} strokeWidth={1.05}/></div>
              <div className="at-modern-card-unit"><strong>{display.unit}</strong>
                <small>{display.title}</small></div></div>
            <div className="at-modern-card-copy"><div><span>{route||'No route'}</span>
                <small>{driver?.display_name||'No assigned driver'}</small></div>
              <div className="at-modern-load-progress">
                <div><span>{isDemo?'Sample loading progress':'Physical load progress'}</span>
                  <strong>{sampleProgress==null?'Not connected':sampleProgress+'%'}</strong></div>
                <div className="at-modern-progress-bar"><span style={{width:(sampleProgress||0)+'%'}}/></div>
              </div></div>
          </button>)}
      </div>
      {!filtered.length&&<Empty message={cards.length?'No matching vehicles':'No vehicles registered yet'}/>}
    </section>
    {active&&<div className="at-modern-modal" onMouseDown={e=>{
      if(e.currentTarget===e.target)setFocused('');
    }}><div className="at-modern-modal-content" role="dialog" aria-modal="true"
      aria-label={'3D model for '+active.display.unit}>
      <div className="at-modern-modal-head"><div><span>FLEET VISUALIZATION</span>
        <h3>{active.display.unit} · {active.display.title}</h3></div>
        <button onClick={()=>setFocused('')} aria-label="Close equipment viewer"><X size={20}/></button></div>
      <Vehicle3D key={active.id} vehicle={active.vehicle} isDemo={isDemo}
        title="Interactive vehicle explorer"/>
      <div className="at-modern-equipment-context"><div>Assigned driver: <strong>{active.driver?.display_name||'None'}</strong></div>
        <div>Active load: <strong>{active.assigned?.reference||'None'}</strong></div></div>
      <button className="at-modern-primary" onClick={()=>{setFocused('');onOpenFleet();}}>Open fleet inventory <ArrowRight size={15}/></button>
      </div></div>}
  </div>;
}

function DailyBars({series}){
  const max=Math.max(...series.map(x=>x.count),1);
  return <div className="at-modern-daily-bars" role="img"
    aria-label={'Real created shipment counts: '+series.map(x=>x.date+' '+x.count).join(', ')}>
    {series.map(x=><div key={x.date}><strong>{x.count||''}</strong>
      <span style={{height:Math.max(5,100*x.count/max)+'%'}}/><small>{x.date.slice(5)}</small></div>)}
  </div>;
}
export function DeliveryOverviewDashboard({
  assignments=[],drivers=[],vehicles=[],isDemo=false,role='',
  onOpenDispatch=()=>{},onOpenFleet=()=>{},onReviewLoad=()=>{},
}) {
  const [search,setSearch]=useState('');
  const [focused,setFocused]=useState('');
  const counts=shipmentDashboardCounts(assignments);
  const series=useMemo(()=>shipmentActivityByDay(assignments),[assignments]);
  const sorted=useMemo(()=>[...assignments].sort((a,b)=>
    (Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)),[assignments]);
  const visible=sorted.filter(a=>[a.reference,a.customer_name,a.dropoff_address]
    .join(' ').toLowerCase().includes(search.toLowerCase().trim())).slice(0,10);
  const selected=assignments.find(a=>a.id===focused)||sorted.find(a=>a.vehicle_id)||null;
  const activeVehicle=vehicles.find(v=>v.id===selected?.vehicle_id)||null;
  const linkedDriver=drivers.find(d=>d.user_id===selected?.driver_user_id)||null;
  const planner=isDemo||role==='admin'||role==='dispatcher';
  if(!planner)return <div className="at-modern at-modern-empty"><ShieldCheck size={24}/>
    <strong>Delivery Overview requires dispatcher access.</strong></div>;
  return <div className="at-modern at-modern-delivery">
    <header className="at-modern-header at-modern-delivery-hero"><div className="at-modern-delivery-hero-copy">
      <span>ANDERTRACK / DELIVERY OPERATIONS</span><h2>Welcome to Delivery Overview</h2>
      <p>Monitor assignments, completion trends, and vehicle readiness from one modern workspace.</p>
      <button onClick={onOpenDispatch} className="at-modern-primary"><Plus size={17}/> Manage deliveries</button>
    </div><div className="at-modern-hero-vehicle"><Truck size={110} strokeWidth={1.2}/>
      <small>Actual fleet inventory · illustrative vehicle graphic</small></div></header>
    <div className="at-modern-delivery-body">
      <aside className="at-modern-overview at-modern-delivery-metrics">
        <CardKpi icon={Package} label="Assigned & unassigned orders" value={counts.total} meta="Visible organization shipments"/>
        <CardKpi icon={CheckCircle2} label="Delivered shipments" value={counts.delivered} meta="Recorded completed loads"/>
        <CardKpi icon={Activity} label="Completion rate" value={counts.completionRate+'%'} meta="Within loaded dashboard records"/>
      </aside>
      <section className="at-modern-overview at-modern-delivery-chart">
        <div className="at-modern-section-title"><div><h3>Shipment activity</h3>
          <p>Actual shipment creation timestamps over the last seven calendar days.</p></div>
          <span className="at-modern-pill"><BarChart3 size={14}/> Created shipments</span></div>
        <DailyBars series={series}/>
      </section>
      <section className="at-modern-overview at-modern-orders">
        <div className="at-modern-section-title"><div><h3>Recent Orders</h3><p>Actual authorized load records</p></div>
          <label className="at-modern-search"><Search size={15}/><input value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="Search orders" aria-label="Search recent orders"/></label></div>
        <div className="at-modern-orders-scroll"><table><thead><tr><th>Load</th><th>Customer</th>
          <th>Assigned driver</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {visible.map(a=><tr key={a.id}><td><strong>{a.reference||'Load'}</strong></td>
            <td>{a.customer_name||'Not recorded'}</td><td>{
              drivers.find(d=>d.user_id===a.driver_user_id)?.display_name||'Unassigned'}</td>
            <td><Tag status={a.status}/></td><td><button onClick={()=>onReviewLoad(a.id)}
              aria-label={'Review '+(a.reference||'shipment')}><ChevronRight size={19}/></button></td></tr>)}
          {!visible.length&&<tr><td colSpan={5}>No matching shipment records.</td></tr>}
          </tbody></table></div>
      </section>
      <section className="at-modern-overview at-modern-delivery-vehicle">
        <div className="at-modern-section-title"><div><h3>Vehicle selection · 3D</h3>
          <p>Choose a recorded vehicle assignment to preview its equipment class.</p></div>
          <button onClick={onOpenFleet} className="at-modern-link">Fleet directory <ArrowRight size={15}/></button></div>
        <label className="at-modern-delivery-picker">Active equipment from shipments
          <select value={selected?.id||''} onChange={e=>setFocused(e.target.value)}>
            {sorted.filter(a=>a.vehicle_id).map(a=><option key={a.id} value={a.id}>
              {a.reference||'Load'} · {vehicles.find(v=>v.id===a.vehicle_id)?.unit_number||'Assigned equipment'}</option>)}
          </select></label>
        {activeVehicle?<Vehicle3D key={activeVehicle.id} vehicle={activeVehicle} isDemo={isDemo}
          title="Selected fleet equipment"/>:<Empty message="No shipment has assigned equipment"/>}
        <p className="at-modern-footnote"><ShieldCheck size={14}/> Manufacturer and model only appear when populated in inventory; 3D silhouettes are generic.</p>
      </section>
    </div>
  </div>;
}
