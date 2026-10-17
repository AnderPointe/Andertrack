import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  operationalVehicleRows,fleetHealthCounts,fleetHealthFilter,fleetHealthBreakdown,
  selectedDispatchAssignment,dispatchModeSummary,dispatchModeLocation,dispatchRouteLink,
  DEMO_DISPATCH_MESSAGES,DEMO_DURATION_SERIES,
} from '../src/lib/reference-dashboards.js';
const now=Date.parse('2026-10-17T17:00:00Z');
const vehicles=[
 {id:'v1',unit_number:'TX-42',vehicle_type:'tractor',enabled:true},
 {id:'v2',unit_number:'VAN-51',vehicle_type:'cargo_van',enabled:true},
 {id:'v3',unit_number:'TRK-71',vehicle_type:'box_truck',enabled:false},
 {id:'v4',unit_number:'HOT-01',vehicle_type:'hotshot',enabled:true},
];
const drivers=[{user_id:'d1',display_name:'Jordan Lee'},{user_id:'d2',display_name:'Sam Moss'}];
const assignments=[
 {id:'a1',reference:'AT-101',status:'in_transit',driver_user_id:'d1',vehicle_id:'v1',
  pickup_address:'Midland, TX',dropoff_address:'Odessa, TX'},
 {id:'a2',reference:'AT-102',status:'accepted',driver_user_id:'d2',vehicle_id:'v2'},
 {id:'a3',reference:'AT-103',status:'delivered',driver_user_id:'d2',vehicle_id:'v2'},
];
const locations=[
 {id:'gps1',driver_id:'d1',unit_number:'TX-42',latitude:31.99,longitude:-102.11,last_ping_at:'2026-10-17T16:59:00Z'},
 {id:'gps2',driver_id:'d2',unit_number:'VAN-51',latitude:32.74,longitude:-97.34,last_ping_at:'2026-10-17T16:30:00Z'},
 {id:'gps3',driver_id:'d3',unit_number:'HOT-01',latitude:32.71,longitude:-97.33,last_ping_at:'2026-10-17T16:58:00Z'},
];
const build=(isDemo=false)=>operationalVehicleRows({vehicles,drivers,assignments,locations,isDemo,now});

test('live fleet dashboard never invents health scores, mechanical problems or asset history',()=>{
 const rows=build(false);
 assert.equal(rows.length,4);
 assert.ok(rows.every(r=>r.healthScore===null&&r.sampleAlerts.length===0));
 assert.ok(rows.every(r=>r.healthLabel==='NOT CONNECTED'));
 assert.equal(fleetHealthCounts(rows).averageSampleScore,null);
 assert.equal(fleetHealthBreakdown(rows).reduce((n,r)=>n+r.count,0),0);
});
test('vehicle status is sourced from authorized GPS, enabled equipment and actual active assignments',()=>{
 const rows=build();
 assert.equal(rows.find(r=>r.id==='v1').state,'active');
 assert.equal(rows.find(r=>r.id==='v2').state,'unreported');
 assert.equal(rows.find(r=>r.id==='v3').state,'disabled');
 assert.equal(rows.find(r=>r.id==='v4').state,'idle');
 assert.equal(rows.find(r=>r.id==='v1').driverName,'Jordan Lee');
 assert.equal(rows.find(r=>r.id==='v3').driverName,'Not assigned');
 assert.deepEqual(fleetHealthCounts(rows),{
   total:4,active:1,idle:1,disabled:1,notReporting:1,reporting:2,averageSampleScore:null,
 });
});
test('filters and pagination source helpers do not modify input and search driver or unit',()=>{
 const rows=build();
 const copy=[...rows];
 assert.equal(fleetHealthFilter(rows,{search:'Jordan'}).length,1);
 assert.equal(fleetHealthFilter(rows,{search:'hot-01'}).length,1);
 assert.equal(fleetHealthFilter(rows,{status:'disabled'}).length,1);
 assert.equal(fleetHealthFilter(rows,{sort:'updated'})[0].unitNumber,'TX-42');
 assert.equal(fleetHealthFilter(rows,{status:'maintenance-sample'}).length,0);
 assert.deepEqual(rows,copy);
});
test('synthetic maintenance scores are visibly only in demo mode',()=>{
 const rows=build(true);
 assert.equal(rows[0].healthScore,92);
 assert.equal(rows[2].status,'Idle');
 assert.equal(rows[3].status,'Maintenance');
 assert.ok(rows.some(r=>r.sampleAlerts.length>0));
 assert.ok(fleetHealthCounts(rows).averageSampleScore!==null);
});
test('dispatch selects actual visible assignments and respects empty state',()=>{
 assert.equal(selectedDispatchAssignment(assignments,'a3').id,'a3');
 assert.equal(selectedDispatchAssignment(assignments,'not-found').id,'a1');
 assert.equal(selectedDispatchAssignment([]),null);
});
test('dispatch map only shows fresh GPS from the selected assigned driver',()=>{
 const one=dispatchModeSummary(assignments[0],drivers,vehicles,locations,now);
 assert.equal(one.driver.display_name,'Jordan Lee');
 assert.equal(one.vehicle.unit_number,'TX-42');
 assert.ok(one.hasCurrentGps);
 assert.equal(one.gps.unit_number,'TX-42');
 const two=dispatchModeSummary(assignments[1],drivers,vehicles,locations,now);
 assert.equal(two.hasCurrentGps,false);
 assert.equal(two.gps,null);
 assert.equal(dispatchModeLocation({driver_user_id:'not-my-driver'},locations,now),null);
 assert.equal(dispatchModeSummary(null,drivers,vehicles,locations),null);
});
test('only customer pickup and delivery addresses are handed to third-party routing',()=>{
 const url=dispatchRouteLink(assignments[0]);
 assert.ok(url.includes('Midland%2C%20TX'));
 assert.ok(url.includes('Odessa%2C%20TX'));
 assert.equal(dispatchRouteLink(assignments[1]),null);
 assert.equal(dispatchRouteLink(null),null);
 assert.equal(DEMO_DISPATCH_MESSAGES.length,3);
 assert.ok(DEMO_DURATION_SERIES.length>1);
});
