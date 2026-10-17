import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchMatches,planningSummary,validPickupCoordinates,getDispatchQueueHead,externalRoadRouteUrl } from '../src/lib/dispatch-planner.js';
const now=Date.parse('2026-10-17T13:00:00Z');
const load={id:'load-a',status:'unassigned',division:'CDL',driver_user_id:null,pickup_address:'Midland, TX',
  dropoff_address:'Odessa, TX'};
const drivers=[
 {user_id:'driverA',display_name:'First',license_verified:true,availability:'available',license_class:'A'},
 {user_id:'driverB',display_name:'Second',license_verified:true,availability:'available',license_class:'B'},
 {user_id:'driverC',display_name:'Unverified',license_verified:false,availability:'available',license_class:'A'},
];
const vehicles=[
 {id:'vehicleA',unit_number:'A-100',enabled:true,vehicle_type:'Truck',required_license_class:'A',payload_capacity_lbs:12000},
 {id:'vehicleB',unit_number:'B-100',enabled:true,vehicle_type:'Truck',required_license_class:'B',payload_capacity_lbs:8000},
 {id:'vehicleC',unit_number:'C-100',enabled:true,vehicle_type:'Van',required_license_class:'C',payload_capacity_lbs:1800},
];
const input=(rest={})=>({load,drivers,vehicles,assignments:[load],requests:[],locations:[],now,...rest});

test('eligibility respects division, verified license, availability, and class hierarchy',()=>{
 const all=dispatchMatches(input());
 assert.equal(all.length,6);
 assert.equal(all.filter(c=>c.eligible).length,3);
 assert.ok(all.every(c=>!c.eligible||c.vehicleClass==='A'||c.vehicleClass==='B'));
 assert.ok(all.some(c=>c.driverId==='driverC' && c.reasons.includes('Driver license not verified')));
 assert.ok(all.some(c=>c.driverId==='driverB' && c.vehicleClass==='A' && !c.eligible));
});
test('the oldest server FIFO request is the only recommendable driver',()=>{
 const requests=[
  {id:'later',status:'queued',driver_user_id:'driverB',queue_number:20,requested_at:'2026-10-17T12:00:00Z'},
  {id:'earlier',status:'queued',driver_user_id:'driverA',queue_number:4,requested_at:'2026-10-17T12:05:00Z'},
 ];
 assert.equal(getDispatchQueueHead(requests).id,'earlier');
 const matches=dispatchMatches(input({requests}));
 assert.ok(matches.filter(c=>c.eligible).every(c=>c.driverId==='driverA'));
 assert.ok(matches.some(c=>c.driverId==='driverB' && c.reasons.some(r=>r.startsWith('FIFO'))));
 assert.equal(planningSummary(matches,requests).fifoWaiting,true);
});
test('a driver or vehicle already on another active load is not recommended',()=>{
 const assignments=[load,{id:'other',status:'in_transit',driver_user_id:'driverA',vehicle_id:'vehicleB'}];
 const all=dispatchMatches(input({assignments}));
 assert.ok(all.every(c=>!c.eligible || (c.driverId!=='driverA' && c.vehicleId!=='vehicleB')));
});
test('proposed payload requires a real capacity and is never silently assumed checked',()=>{
 const candidates=dispatchMatches(input({requiredWeightLbs:8500}));
 assert.ok(candidates.filter(c=>c.eligible).every(c=>c.vehicleId==='vehicleA'));
 assert.ok(candidates.some(c=>c.vehicleId==='vehicleB'&&c.reasons.some(r=>r.includes('exceeds'))));
 assert.equal(dispatchMatches(input()).find(c=>c.eligible).payloadChecked,false);
 const withUnknown=dispatchMatches(input({vehicles:[{...vehicles[0],payload_capacity_lbs:null}],requiredWeightLbs:1000}));
 assert.ok(withUnknown.every(c=>!c.eligible));
 assert.ok(dispatchMatches(input({requiredWeightLbs:0})).every(c=>!c.eligible));
});
test('pickup proximity requires manually provided coordinates AND fresh authorized GPS',()=>{
 const pickup={latitude:31.997,longitude:-102.07};
 const locations=[
  {id:'gpsA',driver_id:'driverA',latitude:31.99,longitude:-102.07,last_ping_at:'2026-10-17T12:59:00Z'},
  {id:'gpsB',driver_id:'driverB',latitude:31.998,longitude:-102.065,last_ping_at:'2026-10-17T12:45:00Z'},
 ];
 const c=dispatchMatches(input({pickup,locations}));
 assert.ok(c.some(x=>x.driverId==='driverA' && x.distanceMiles>0 && x.distanceMiles<2));
 assert.ok(c.filter(x=>x.driverId==='driverB').every(x=>x.distanceMiles===null));
 assert.ok(dispatchMatches(input({locations})).every(x=>x.distanceMiles===null));
 assert.equal(validPickupCoordinates('','-97'),null);
 assert.equal(validPickupCoordinates('91','-97'),null);
 assert.deepEqual(validPickupCoordinates('31.997','-102.07'),pickup);
});
test('external route is only an address handoff with safe URL encoding',()=>{
 assert.match(externalRoadRouteUrl(load),/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/);
 assert.ok(externalRoadRouteUrl(load).includes('Midland%2C%20TX'));
 assert.equal(externalRoadRouteUrl({...load,dropoff_address:'  '}),null);
 assert.ok(!externalRoadRouteUrl(load).includes('eta_minutes'));
});
test('no data cannot fabricate available dispatch matches',()=>{
 assert.deepEqual(dispatchMatches(input({drivers:[],vehicles:[]})),[]);
 assert.deepEqual(dispatchMatches(input({load:{...load,status:'accepted'}})),[]);
 assert.equal(planningSummary([]).recommended,null);
});
