import {freshGpsPosition,validGpsPosition,ACTIVE_STATUSES} from './operations.js';
import {classCEligibility} from './class-c-operations.js';

// Build a map from already authenticated, RLS-scoped vehicle, assignment and GPS
// rows. Never attempt to derive lat/lng from a delivery address or an IP.
export function classCMapRecords({
  vehicles=[],assignments=[],locations=[],role='',currentUserId='',isDemo=false,
  now=Date.now(),
}={}) {
  const planner=isDemo||role==='admin'||role==='dispatcher';
  const allowedAssignments=assignments.filter(a=>
    ACTIVE_STATUSES.has(a.status)&&a.vehicle_id&&a.driver_user_id&&
    (planner||a.driver_user_id===currentUserId));
  const units=vehicles.filter(vehicle=>classCEligibility(vehicle).eligible)
    .map(vehicle=>{
      const links=allowedAssignments.filter(a=>a.vehicle_id===vehicle.id);
      if(!links.length)return null;
      const driverId=links[0].driver_user_id;
      // A driver can have multiple units. Only a matching unit-tagged GPS row
      // (or an unambiguous assignment if the feed has no unit) is accepted.
      const normalizedUnit=String(vehicle.unit_number||'').trim().toLowerCase();
      const sameDriverAssignments=allowedAssignments.filter(a=>a.driver_user_id===driverId);
      const unambiguous=sameDriverAssignments.length===1;
      const matching=locations.filter(location=>{
        if(location.driver_id!==driverId||!freshGpsPosition(location,now))return false;
        const reportedUnit=String(location.unit_number||'').trim().toLowerCase();
        if(reportedUnit)return !!normalizedUnit&&reportedUnit===normalizedUnit;
        return unambiguous;
      }).sort((a,b)=>Date.parse(b.last_ping_at||'')-Date.parse(a.last_ping_at||''));
      const point=matching[0];
      if(!point)return null;
      const link=links[0];
      return {
        id:vehicle.id,vehicle,assignment:link,location:point,unit:vehicle.unit_number,
        driverId,latitude:Number(point.latitude),longitude:Number(point.longitude),
        lastPing:point.last_ping_at,
      };
    }).filter(Boolean);
  return units;
}
export function classCMapStats({
  vehicles=[],assignments=[],locations=[],role='',currentUserId='',isDemo=false,now=Date.now(),
}={}) {
  const positioned=classCMapRecords({vehicles,assignments,locations,role,currentUserId,isDemo,now});
  const permitted=vehicles.filter(v=>classCEligibility(v).eligible);
  const active=assignments.filter(a=>ACTIVE_STATUSES.has(a.status)&&a.vehicle_id
    && permitted.some(v=>v.id===a.vehicle_id)
    && (role!=='driver'||isDemo||a.driver_user_id===currentUserId));
  return {visibleGps:positioned.length,activeClassCLoads:active.length,
    eligibleVehicles:permitted.length,positioned};
}
/** Reduce map markers to the globally filtered, already-authorized inventory.
 * Null means no fleet filter; an empty array intentionally shows no markers.
 * Fleet totals and safety/maintenance reports remain computed from original scope.
 */
export function filterClassCMapPositions(positioned=[],visibleVehicleIds=null) {
  if(!Array.isArray(visibleVehicleIds))return positioned;
  const allowed=new Set(visibleVehicleIds);
  return positioned.filter(point=>allowed.has(point.vehicle?.id));
}
export function classCDirectionsUrl(assignment) {
  const a=String(assignment?.pickup_address||'').trim();
  const b=String(assignment?.dropoff_address||'').trim();
  if(!a||!b||a.length>500||b.length>500)return null;
  return 'https://www.google.com/maps/dir/?api=1&origin='+
    encodeURIComponent(a)+'&destination='+encodeURIComponent(b)+'&travelmode=driving';
}
export function classCPositionUrl(location) {
  if(!validGpsPosition(location))return null;
  return 'https://www.google.com/maps/search/?api=1&query='+
    encodeURIComponent(Number(location.latitude)+','+Number(location.longitude));
}
export function classCMapSummary(unit) {
  if(!unit)return {unit:'No linked GPS',status:'No fresh assigned position',hasPosition:false};
  return {unit:unit.unit,status:String(unit.location.status||unit.assignment.status||'reported')
    .replaceAll('_',' '),hasPosition:true};
}
