import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoDistanceMiles,replayPoints,traceSummary,fencePosition,fleetObservations,HISTORY_WINDOWS } from '../src/lib/fleet-intelligence.js';

const now=Date.parse('2026-10-17T15:00:00Z');
const point=(at,latitude=32.75,longitude=-97.33,other={})=>
 ({id:at,driver_id:'driver-1',latitude,longitude,recorded_at:at,accuracy_meters:20,...other});
const rows=[
 point('2026-10-17T14:00:00Z',32.75,-97.33,{speed_mph:20}),
 point('2026-10-17T14:10:00Z',32.76,-97.32,{speed_mph:31}),
 point('2026-10-17T14:15:00Z',32.77,-97.30,{speed_mph:30}),
];

test('geoDistanceMiles returns approximately expected values, validates coordinates',()=>{
 assert.equal(geoDistanceMiles(rows[0],rows[0]),0);
 assert.ok(geoDistanceMiles(rows[0],rows[1])>0.8);
 assert.ok(geoDistanceMiles(rows[0],rows[1])<1.2);
 assert.equal(geoDistanceMiles(rows[0],{latitude:null,longitude:0}),null);
});
test('history scrubber excludes future, duplicate, missing and inaccurate points',()=>{
 const points=replayPoints([
  rows[2],rows[1],rows[0],
  point('2026-10-17T14:10:00Z',40,-110), // duplicate timestamp for same driver
  point('2026-10-17T15:01:00Z',32.8,-97.3),
  point('2026-10-17T14:50:00Z',32.8,-97.3,{accuracy_meters:900}),
  point('bad',32.8,-97.3),
  point('2026-10-17T14:51:00Z',null,-97.3),
 ],now);
 assert.deepEqual(points.map(p=>p.recorded_at),rows.map(p=>p.recorded_at));
});
test('segment distance explicitly excludes unreasonable GPS jumps',()=>{
 const positions=[...rows,point('2026-10-17T14:16:00Z',40.2,-111)];
 const report=traceSummary(positions);
 assert.equal(report.points,4);
 assert.equal(report.segments,2);
 assert.equal(report.suspectJumps,1);
 assert.ok(report.straightSegmentMiles>1);
 assert.equal(report.maxReportedSpeedMph,31);
});
test('configured monitoring circle flags outside, inside or unknown',()=>{
 const fence={latitude:32.75,longitude:-97.33,radiusMiles:3};
 assert.equal(fencePosition(rows[0],fence),'inside');
 assert.equal(fencePosition({latitude:33,longitude:-97.33},fence),'outside');
 assert.equal(fencePosition({latitude:0,longitude:null},fence),'unknown');
 assert.equal(fencePosition(rows[0],{...fence,radiusMiles:0}),'unknown');
});
test('observations are review cues, not violations; use recent GPS only',()=>{
 const loc=[
   {id:'a',unit_number:'A',latitude:32.75,longitude:-97.33,speed_mph:84,last_ping_at:'2026-10-17T14:59:00Z'},
   {id:'b',unit_number:'B',latitude:32.80,longitude:-97.30,speed_mph:90,last_ping_at:'2026-10-17T14:40:00Z'},
 ];
 const notes=fleetObservations(loc,{latitude:32.75,longitude:-97.33,radiusMiles:2},now);
 assert.ok(notes.some(x=>x.kind==='speed'&&x.detail.toLowerCase().includes('review')));
 assert.ok(notes.some(x=>x.id==='stale:b'));
 assert.ok(!notes.some(x=>x.id==='speed:b'));
 assert.ok(!notes.some(x=>x.kind==='fence'&&x.id==='fence:b'));
});
test('empty samples do not manufacture trips, speed or alerts',()=>{
 assert.deepEqual(fleetObservations([],null,now),[]);
 assert.equal(traceSummary([]).points,0);
 assert.equal(traceSummary([]).maxReportedSpeedMph,null);
 assert.equal(HISTORY_WINDOWS['7d'],604800000);
});
