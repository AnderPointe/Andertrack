import {ACTIVE_STATUSES,freshGpsPosition} from './operations.js';

const DEMO_HEALTH = Object.freeze({
  v1:{score:92,condition:'Operational',alerts:[]},
  v2:{score:86,condition:'Operational',alerts:[]},
  v3:{score:63,condition:'Idle',alerts:[{title:'Tire pressure review',severity:'medium',detail:'Sample device alert · not a real TPMS reading'}]},
  v4:{score:45,condition:'Maintenance',alerts:[{title:'Engine oil service review',severity:'medium',detail:'Sample maintenance record · not a live engine sensor'}]},
  v5:{score:18,condition:'Out of service',alerts:[{title:'Brake inspection review',severity:'high',detail:'Sample inspection alert · not a real defect report'}]},
});
export function demoHealthFor(vehicle, index) {
  return DEMO_HEALTH[vehicle?.id]??Object.values(DEMO_HEALTH)[index%5];
}
export function operationalVehicleRows({vehicles=[],drivers=[],assignments=[],locations=[],isDemo=false,now=Date.now()}={}) {
  const byDriver=new Map(drivers.map(d=>[d.user_id,d]));
  return vehicles.map((vehicle,index)=>{
    // Associate GPS by vehicle_id when populated, otherwise only an unambiguous
    // normalized unit number. Never rely on assignment GPS from another tenant.
    const unit=String(vehicle.unit_number||'').trim().toLowerCase();
    const gps=locations.find(p=>p.vehicle_id&&p.vehicle_id===vehicle.id) ||
      (unit?locations.find(p=>String(p.unit_number||'').trim().toLowerCase()===unit):null);
    const recent=!!gps&&freshGpsPosition(gps,now);
    const assignment=assignments.find(a=>a.vehicle_id===vehicle.id&&ACTIVE_STATUSES.has(a.status))||null;
    const driver=assignment?.driver_user_id?byDriver.get(assignment.driver_user_id):null;
    const sample=isDemo?demoHealthFor(vehicle,index):null;
    const state=!vehicle.enabled?'disabled':recent&&assignment?'active':recent?'idle':'unreported';
    const lastUpdate=gps?.last_ping_at||null;
    return {
      id:vehicle.id||'row-'+index,unitNumber:vehicle.unit_number||'Unnumbered unit',
      type:vehicle.vehicle_type||'Unknown type',
      driverName:driver?.display_name||'Not assigned',
      driverId:driver?.user_id||null,
      status:sample?.condition||state,
      state,enabled:!!vehicle.enabled,reported:recent,lastUpdate,
      healthScore:sample?.score??null,healthLabel:isDemo?'SAMPLE SCORE':'NOT CONNECTED',
      sampleAlerts:sample?.alerts||[],vehicle,assignment,gps,
    };
  });
}
export function fleetHealthCounts(rows=[]) {
  return {
    total:rows.length,
    active:rows.filter(r=>r.state==='active').length,
    idle:rows.filter(r=>r.state==='idle').length,
    disabled:rows.filter(r=>r.state==='disabled').length,
    notReporting:rows.filter(r=>r.state==='unreported').length,
    reporting:rows.filter(r=>r.reported).length,
    // Health scores are never aggregated for production when unavailable.
    averageSampleScore:rows.length&&rows.every(r=>r.healthScore!=null)?
      Math.round(rows.reduce((n,r)=>n+r.healthScore,0)/rows.length):null,
  };
}
export function fleetHealthFilter(rows=[],{search='',status='all',sort='unit'}={}) {
  const needle=String(search||'').toLowerCase().trim();
  const matching=rows.filter(r=>
    (status==='all'||r.state===status||
      status==='maintenance-sample'&&r.status==='Maintenance')&&
    [r.unitNumber,r.driverName,r.type,r.status].join(' ').toLowerCase().includes(needle)
  );
  return matching.sort((a,b)=>{
    if(sort==='score')return (a.healthScore==null?1:0)-(b.healthScore==null?1:0) ||
      (b.healthScore??0)-(a.healthScore??0) || a.unitNumber.localeCompare(b.unitNumber);
    if(sort==='updated')return (Date.parse(b.lastUpdate||'')||0)-
      (Date.parse(a.lastUpdate||'')||0) || a.unitNumber.localeCompare(b.unitNumber);
    return a.unitNumber.localeCompare(b.unitNumber);
  });
}
export function fleetHealthBreakdown(rows=[]) {
  const result=[['Excellent',80,100],['Good',60,79],['Fair',40,59],['Poor',20,39],['Critical',0,19]]
    .map(([label,min,max])=>({label,count:rows.filter(r=>r.healthScore!=null&&
      r.healthScore>=min&&r.healthScore<=max).length}));
  return result;
}
export function selectedDispatchAssignment(assignments=[],requestedId='') {
  return assignments.find(a=>a.id===requestedId)||
    assignments.find(a=>ACTIVE_STATUSES.has(a.status))||assignments[0]||null;
}
export function dispatchModeLocation(assignment,locations=[],now=Date.now()) {
  if(!assignment?.driver_user_id)return null;
  const matches=locations.filter(l=>l.driver_id===assignment.driver_user_id);
  const recent=matches.filter(l=>freshGpsPosition(l,now)).sort((a,b)=>
    Date.parse(b.last_ping_at||'')-Date.parse(a.last_ping_at||''))[0];
  return recent||null;
}
export function dispatchModeSummary(assignment,drivers=[],vehicles=[],locations=[],now=Date.now()) {
  if(!assignment)return null;
  const driver=drivers.find(d=>d.user_id===assignment.driver_user_id)||null;
  const vehicle=vehicles.find(v=>v.id===assignment.vehicle_id)||null;
  const gps=dispatchModeLocation(assignment,locations,now);
  return {assignment,driver,vehicle,gps,hasCurrentGps:!!gps,
    canRoute:!!String(assignment.pickup_address||'').trim()&&
      !!String(assignment.dropoff_address||'').trim()};
}
export function dispatchRouteLink(assignment) {
  const origin=String(assignment?.pickup_address||'').trim();
  const destination=String(assignment?.dropoff_address||'').trim();
  if(!origin||!destination||origin.length>500||destination.length>500)return null;
  return 'https://www.google.com/maps/dir/?api=1&origin='+
    encodeURIComponent(origin)+'&destination='+encodeURIComponent(destination)+'&travelmode=driving';
}
export const DEMO_DISPATCH_MESSAGES = Object.freeze([
  {id:'m1',speaker:'dispatcher',text:'Please confirm your next pickup and send an update when you reach the location.',time:'09:04'},
  {id:'m2',speaker:'driver',text:'Copy that. The example load is showing as in transit.',time:'09:06'},
  {id:'m3',speaker:'dispatcher',text:'Thanks. Use the authorized workflow for actual shipment changes.',time:'09:08'},
]);
export const DEMO_DURATION_SERIES = Object.freeze([
  {label:'00',estimated:5,actual:4},{label:'10',estimated:11,actual:9},
  {label:'20',estimated:18,actual:15},{label:'30',estimated:14,actual:13},
  {label:'40',estimated:22,actual:16},{label:'50',estimated:16,actual:11},
  {label:'60',estimated:12,actual:8},
]);
