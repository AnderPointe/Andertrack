import { freshGpsPosition, validGpsPosition, ACTIVE_STATUSES } from './operations.js';
import { geoDistanceMiles } from './fleet-intelligence.js';
import { screenVehicleSafety } from './fleet-safety-interlocks.js';

// Deterministic dispatch screening and scenario comparison, not ML predictions.
// Server RPCs must independently validate all real offers and FIFO queue claims.
const LICENSE_LEVEL = Object.freeze({ C: 1, B: 2, A: 3 });
const queuePosition = r => {
  const n=Number(r?.queue_number);
  return Number.isFinite(n) ? n : Infinity;
};
const alphabetic = (a,b) => String(a||'').localeCompare(String(b||''));
export const DISTANCE_LABEL = 'Straight-line proximity only — not roadway miles or ETA.';

export function validPickupCoordinates(latitude,longitude) {
  if (latitude == null || longitude == null ||
      String(latitude).trim() === '' || String(longitude).trim() === '') return null;
  const point={latitude:Number(latitude),longitude:Number(longitude)};
  return validGpsPosition(point) ? point : null;
}

export function getDispatchQueueHead(requests=[]) {
  return (requests||[]).filter(r=>r?.status==='queued')
    .sort((a,b)=>queuePosition(a)-queuePosition(b) ||
      Date.parse(a.requested_at||'')-Date.parse(b.requested_at||'') ||
      alphabetic(a.id,b.id))[0] || null;
}

function isVehicleEligible(load,vehicle) {
  if (!vehicle?.enabled) return false;
  const license=vehicle.required_license_class;
  if (load?.division==='CDL') return license==='A'||license==='B';
  if (load?.division==='Class C') return license==='C';
  return false;
}

function driverHasQualification(driver,vehicle) {
  return Boolean(driver?.license_verified && driver.availability==='available' &&
    LICENSE_LEVEL[driver.license_class] >= LICENSE_LEVEL[vehicle.required_license_class]);
}

export function dispatchMatches({
  load,drivers=[],vehicles=[],assignments=[],requests=[],locations=[],
  pickup=null,requiredWeightLbs=null,now=Date.now(),
  safetySnapshot=null,safetyOrganizationId='',
}={}) {
  if (!load?.id || load.status!=='unassigned' || load.driver_user_id) return [];
  const queuedHead=getDispatchQueueHead(requests);
  const busyDriverIds=new Set((assignments||[]).filter(a=>
    a.id!==load.id && ACTIVE_STATUSES.has(a.status) && a.driver_user_id)
    .map(a=>a.driver_user_id));
  const busyVehicleIds=new Set((assignments||[]).filter(a=>
    a.id!==load.id && ACTIVE_STATUSES.has(a.status) && a.vehicle_id)
    .map(a=>a.vehicle_id));

  // A load's package mass isn't currently a persisted database field.
  // Without an entered mass, DO NOT pretend payload capacity has been checked.
  const mass=requiredWeightLbs==null||requiredWeightLbs===''?null:Number(requiredWeightLbs);
  const massValid=mass===null||(Number.isFinite(mass)&&mass>0);
  const candidates=[];
  for(const vehicle of vehicles||[]){
    if(!isVehicleEligible(load,vehicle)) continue;
    for(const driver of drivers||[]){
      if (!driver?.user_id || !vehicle.id) continue;
      // Present only superficially qualified pairs; rejected ones display separately
      // as reasoned "not ready" items for dispatcher evaluation.
      const reasons=[];
      if (!driver.license_verified) reasons.push('Driver license not verified');
      if (driver.availability!=='available') reasons.push('Driver not marked available');
      if (!LICENSE_LEVEL[driver.license_class] ||
          LICENSE_LEVEL[driver.license_class]<LICENSE_LEVEL[vehicle.required_license_class])
        reasons.push('License class does not meet vehicle requirement');
      if (busyDriverIds.has(driver.user_id)) reasons.push('Driver has another active assignment');
      if (busyVehicleIds.has(vehicle.id)) reasons.push('Vehicle has another active assignment');
      if (safetySnapshot) {
        const safety=screenVehicleSafety(safetySnapshot,vehicle.id,{
          organizationId:safetyOrganizationId,now,
        });
        if(!safety.eligible)reasons.push(safety.reason);
      }
      if(queuedHead && queuedHead.driver_user_id!==driver.user_id)
        reasons.push('FIFO queue: oldest request must be served first');
      if(!massValid) reasons.push('Invalid proposed shipment weight');
      if(mass!==null && massValid){
        const capacity=vehicle.payload_capacity_lbs==null?null:Number(vehicle.payload_capacity_lbs);
        if(capacity===null || !Number.isFinite(capacity) || capacity<=0)
          reasons.push('Vehicle payload capacity not verified');
        else if(capacity<mass) reasons.push('Proposed shipment weight exceeds vehicle capacity');
      }
      const gps=(locations||[]).find(p=>p.driver_id===driver.user_id && freshGpsPosition(p,now));
      const proximity=pickup && gps ? geoDistanceMiles(gps,pickup) : null;
      const eligible=reasons.length===0;
      candidates.push({
        id:driver.user_id+':'+vehicle.id,
        driverId:driver.user_id,driverName:driver.display_name||'Driver',
        licenseClass:driver.license_class,vehicleId:vehicle.id,
        vehicleName:vehicle.unit_number||vehicle.vehicle_type||'Vehicle',
        vehicleClass:vehicle.required_license_class,vehicleType:vehicle.vehicle_type||'',
        capacityLbs:vehicle.payload_capacity_lbs==null?null:Number(vehicle.payload_capacity_lbs),
        distanceMiles:proximity,
        gpsRecent:!!gps,
        payloadChecked:mass!==null && massValid,
        fifoHead:Boolean(queuedHead && queuedHead.driver_user_id===driver.user_id),
        eligible,reasons,
      });
    }
  }
  candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible) ||
    // Distances only break ties between otherwise eligible pairs and never
    // silently promote a queue-ineligible driver above the FIFO head.
    Number(a.distanceMiles==null)-Number(b.distanceMiles==null) ||
    (a.distanceMiles??Infinity)-(b.distanceMiles??Infinity) ||
    alphabetic(a.driverName,b.driverName) ||
    alphabetic(a.vehicleName,b.vehicleName));
  return candidates;
}

export function planningSummary(candidates=[], requests=[], pickup=null, weight=null) {
  const accepted=candidates.filter(c=>c.eligible);
  const head=getDispatchQueueHead(requests);
  return {
    evaluated:candidates.length,ready:accepted.length,
    unverifiedGps:accepted.filter(c=>!c.gpsRecent).length,
    fifoWaiting:!!head,
    hasPickup:!!pickup,
    weightUnverified:weight==null||weight==='',
    recommended:accepted[0]||null,
  };
}

export function externalRoadRouteUrl(load) {
  const pickup=String(load?.pickup_address||'').trim();
  const dropoff=String(load?.dropoff_address||'').trim();
  if (!pickup || !dropoff || pickup.length>500 || dropoff.length>500) return null;
  // External consumer mapping provider performs routing *after* the operator opens it;
  // this application does not claim to calculate routes, ETA or truck restrictions.
  return 'https://www.google.com/maps/dir/?api=1&origin='+
    encodeURIComponent(pickup)+'&destination='+encodeURIComponent(dropoff)+'&travelmode=driving';
}
