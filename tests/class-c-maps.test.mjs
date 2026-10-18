import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  classCMapRecords,classCMapStats,classCDirectionsUrl,classCPositionUrl,classCMapSummary,
} from '../src/lib/class-c-maps.js';

const now=Date.parse('2026-10-17T19:00:00Z');
const vehicles=[
  {id:'v1',unit_number:'VAN-100',vehicle_type:'cargo_van',enabled:true,gvwr_lbs:9200},
  {id:'v2',unit_number:'BOX-200',vehicle_type:'box_truck',enabled:true,gvwr_lbs:25500},
  {id:'v3',unit_number:'TR-300',vehicle_type:'tractor',enabled:true,gvwr_lbs:40000},
  {id:'v4',unit_number:'VAN-400',vehicle_type:'cargo_van',enabled:true,gvwr_lbs:9900},
];
const assignments=[
  {id:'a1',driver_user_id:'driver1',vehicle_id:'v1',status:'in_transit',reference:'AT-1',
    pickup_address:'Fort Worth, TX',dropoff_address:'Burleson, TX'},
  {id:'a2',driver_user_id:'driver2',vehicle_id:'v2',status:'accepted',reference:'AT-2',
    pickup_address:'Dallas, TX',dropoff_address:'Irving, TX'},
  {id:'a3',driver_user_id:'driver3',vehicle_id:'v3',status:'in_transit',reference:'AT-3'},
  {id:'a4',driver_user_id:'driver1',vehicle_id:'v4',status:'assigned',reference:'AT-4'},
];
const locs=[
  {id:'l1',driver_id:'driver1',unit_number:'VAN-100',latitude:32.745,longitude:-97.330,
    status:'in_transit',speed_mph:28,last_ping_at:'2026-10-17T18:59:00Z'},
  {id:'l2',driver_id:'driver2',unit_number:'BOX-200',latitude:32.9,longitude:-96.81,
    status:'accepted',last_ping_at:'2026-10-17T18:58:00Z'},
  {id:'l3',driver_id:'driver3',unit_number:'TR-300',latitude:33.1,longitude:-97.6,
    status:'in_transit',last_ping_at:'2026-10-17T18:59:00Z'},
  {id:'l4',driver_id:'driver1',unit_number:'VAN-400',latitude:32.51,longitude:-97.12,
    status:'assigned',last_ping_at:'2026-10-17T18:45:00Z'},
  {id:'l5',driver_id:'driver1',unit_number:'BOX-200',latitude:30.1,longitude:-94.0,
    status:'in_transit',last_ping_at:'2026-10-17T18:59:00Z'},
];
test('class C map shows only fresh positions matched to active driver + unit',()=>{
 const rows=classCMapRecords({vehicles,assignments,locations:locs,role:'admin',now});
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.unit),['VAN-100','BOX-200']);
 assert.equal(rows[0].location.id,'l1');
 assert.equal(rows[1].location.id,'l2');
 assert.ok(rows.every(x=>x.lastPing));
});
test('Class C driver only sees own linked unit and never other driver GPS',()=>{
 const rows=classCMapRecords({vehicles,assignments,locations:locs,role:'driver',
    currentUserId:'driver1',now});
 assert.deepEqual(rows.map(x=>x.unit),['VAN-100']);
 assert.equal(rows[0].driverId,'driver1');
 const other=classCMapRecords({vehicles,assignments,locations:locs,role:'driver',
    currentUserId:'driver2',now});
 assert.deepEqual(other.map(x=>x.unit),['BOX-200']);
 const unknown=classCMapRecords({vehicles,assignments,locations:locs,role:'driver',
    currentUserId:'missing',now});
 assert.equal(unknown.length,0);
});
test('unassigned, stale and future GPS are refused',()=>{
 assert.equal(classCMapRecords({vehicles,assignments:[],locations:locs,role:'admin',now}).length,0);
 const future=locs.map(l=>({...l,last_ping_at:'2026-10-17T19:02:00Z'}));
 assert.equal(classCMapRecords({vehicles,assignments,locations:future,role:'admin',now}).length,0);
 const stale=locs.map(l=>({...l,last_ping_at:'2026-10-17T18:00:00Z'}));
 assert.equal(classCMapRecords({vehicles,assignments,locations:stale,role:'admin',now}).length,0);
});
test('unitless GPS is used only for unambiguous active driver equipment',()=>{
 const unitless=locs.map(l=>({...l,unit_number:''}));
 const rows=classCMapRecords({vehicles,assignments,locations:unitless,role:'admin',now});
 assert.deepEqual(rows.map(x=>x.unit),['BOX-200']);
});
test('map counts actual authorized active assignments rather than demo health totals',()=>{
 const summary=classCMapStats({vehicles,assignments,locations:locs,role:'admin',now});
 assert.equal(summary.eligibleVehicles,3);
 assert.equal(summary.activeClassCLoads,3);
 assert.equal(summary.visibleGps,2);
 assert.equal(summary.positioned.length,2);
});
test('map directions only open validated source/destination links on click',()=>{
 const url=classCDirectionsUrl(assignments[0]);
 assert.ok(url.startsWith('https://www.google.com/maps/dir/?api=1&origin='));
 assert.ok(url.includes('Fort%20Worth%2C%20TX'));
 assert.ok(url.includes('Burleson%2C%20TX'));
 assert.equal(classCDirectionsUrl({...assignments[0],dropoff_address:''}),null);
 assert.equal(classCDirectionsUrl(null),null);
 assert.equal(classCDirectionsUrl({...assignments[0],pickup_address:'x'.repeat(501)}),null);
 const point=classCPositionUrl(locs[0]);
 assert.ok(point.includes('32.745%2C-97.33'));
 assert.equal(classCPositionUrl({latitude:999,longitude:0}),null);
 assert.equal(classCPositionUrl(null),null);
});
test('location popup metadata is derived without inventing any speed or heading',()=>{
 assert.equal(classCMapSummary(null).hasPosition,false);
 const x=classCMapRecords({vehicles,assignments,locations:locs,role:'admin',now})[0];
 const summary=classCMapSummary(x);
 assert.equal(summary.unit,'VAN-100');
 assert.equal(summary.status,'in transit');
});
