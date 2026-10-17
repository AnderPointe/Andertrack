import {ACTIVE_STATUSES} from './operations.js';
import {vehicleDisplay} from './vehicle-3d.js';
const LOADING_STATES=new Set(['accepted','at_pickup','picked_up','in_transit']);
const DEMO_PCTS=[48,0,92,100,12,70,0,45];
export function warehouseCards({vehicles=[],assignments=[],drivers=[],isDemo=false}={}) {
  const byId=new Map(drivers.map(x=>[x.user_id,x]));
  return vehicles.map((vehicle,i)=>{
    const assigned=assignments.find(a=>a.vehicle_id===vehicle.id
      && ACTIVE_STATUSES.has(a.status))||null;
    const driver=assigned?.driver_user_id?byId.get(assigned.driver_user_id):null;
    const state=!vehicle.enabled?'Unavailable':assigned?'Assigned':'Ready';
    return {id:vehicle.id,vehicle,assigned,driver,
      state,route:assigned?[assigned.pickup_address,assigned.dropoff_address].filter(Boolean).join(' → '):'No active route',
      // No cargo mass / dock / load progress column exists. Synthetic only in demo.
      sampleProgress:isDemo?DEMO_PCTS[i%DEMO_PCTS.length]:null,
      display:vehicleDisplay(vehicle),
    };
  });
}
export function warehouseCounts(cards=[],assignments=[]) {
  return {registered:cards.length,
    assigned:cards.filter(x=>x.state==='Assigned').length,
    ready:cards.filter(x=>x.state==='Ready').length,
    disabled:cards.filter(x=>x.state==='Unavailable').length,
    unassignedShipments:assignments.filter(a=>a.status==='unassigned').length};
}
export function shipmentDashboardCounts(assignments=[]) {
  const total=assignments.length;
  const delivered=assignments.filter(a=>a.status==='delivered').length;
  const active=assignments.filter(a=>ACTIVE_STATUSES.has(a.status)).length;
  return {total,delivered,active,unassigned:assignments.filter(a=>a.status==='unassigned').length,
    completionRate:total?Math.round(100*delivered/total):0};
}
export function shipmentActivityByDay(assignments=[],now=Date.now(),days=7) {
  const out=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(now-i*86400000);const label=d.toISOString().slice(0,10);
    out.push({date:label,count:assignments.filter(a=>{
      const stamp=Date.parse(a.created_at||'');
      return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===label;
    }).length});
  }
  return out;
}
