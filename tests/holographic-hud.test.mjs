import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compassPoint,hudSnapshot,hudMotionEnabled,safeHudCoordinate,demoHudMission,
} from '../src/lib/holographic-hud.js';

const now=Date.parse('2026-10-17T14:00:00Z');
const point=(changes={})=>({
  id:'loc',latitude:31.9974,longitude:-102.0779,
  speed_mph:54.6,heading:89.7,accuracy_meters:8,battery_percent:78,
  unit_number:'TRACTOR-104',last_ping_at:'2026-10-17T13:59:40Z',...changes,
});

test('HUD shows only actual and recent authorized GPS telemetry in live mode',()=>{
 const latest=hudSnapshot({location:point(),now});
 assert.equal(latest.gpsState,'RECENT GPS');
 assert.equal(latest.speed,54.6);
 assert.equal(latest.headingPoint,'E');
 assert.equal(latest.battery,78);
 assert.equal(latest.secondsAgo,20);
 assert.equal(latest.unit,'TRACTOR-104');
 assert.deepEqual(latest.position,{latitude:31.9974,longitude:-102.0779});
 assert.equal(latest.movingLive,true);
 assert.equal(latest.duty,'NOT CONNECTED');
});

test('stale, future, invalid and absent GPS does not create fake speed, heading or coordinates',()=>{
 for(const loc of [
   point({last_ping_at:'2026-10-17T13:20:00Z'}),
   point({last_ping_at:'2026-10-17T14:02:00Z'}),
   point({latitude:91}),
   null,
 ]) {
   const r=hudSnapshot({location:loc,now});
   assert.equal(r.gpsState,'GPS UNAVAILABLE');
   assert.equal(r.gpsFresh,false);
   assert.equal(r.speed,null);
   assert.equal(r.heading,null);
   assert.equal(r.position,null);
   assert.equal(r.movingLive,false);
   assert.equal(r.duty,'NOT CONNECTED');
 }
});

test('demo is visibly synthetic and never claims a certified device',()=>{
 const r=hudSnapshot({
   isDemo:true,person:{unit:'SAMPLE-100',status:'D'},
   location:point(),dutyStatus:'OFF',now,
 });
 assert.equal(r.isDemo,true);
 assert.equal(r.gpsState,'SYNTHETIC DEMO');
 assert.equal(r.duty,'OFF');
 assert.equal(r.signalNote,'Fictional position / telemetry');
 assert.equal(r.movingLive,false);
});
test('moving real vehicle and reduced-motion settings forcibly disable decorative animation',()=>{
 assert.equal(hudMotionEnabled({visible:true,requested:true}),true);
 assert.equal(hudMotionEnabled({visible:true,requested:false}),false);
 assert.equal(hudMotionEnabled({visible:true,requested:true,reducedMotion:true}),false);
 assert.equal(hudMotionEnabled({visible:true,requested:true,movingLive:true}),false);
 assert.equal(hudMotionEnabled({visible:false,requested:true}),false);
});
test('compass labels and coordinates safely validate edge cases',()=>{
 assert.equal(compassPoint(0),'N');
 assert.equal(compassPoint(45),'NE');
 assert.equal(compassPoint(90),'E');
 assert.equal(compassPoint(359),'N');
 assert.equal(compassPoint(null),'—');
 assert.equal(compassPoint(9999),'—');
 assert.equal(safeHudCoordinate(-102.0779,'lng'),'-102.0779°');
 assert.equal(safeHudCoordinate(98,'lat'),'—');
 assert.equal(safeHudCoordinate(undefined),'—');
});
test('mission preview only uses an assigned shipment or clearly sample details',()=>{
 assert.deepEqual(demoHudMission({reference:'DEMO-001',address:'Fort Worth, TX'},null),
   {title:'DEMO-001',destination:'Fort Worth, TX'});
 assert.deepEqual(demoHudMission(null,{reference:'AT-120',dropoff_address:'Odessa, TX'}),
   {title:'AT-120',destination:'Odessa, TX'});
 assert.deepEqual(demoHudMission(null,null),
   {title:'NO ACTIVE MISSION',destination:'Not assigned'});
});
