import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 NORTHVALE_TABS,NORTHVALE_DEMO,NORTHVALE_DEMO_VEHICLES,
 NORTHVALE_DEMO_SCHEDULE,NORTHVALE_DEMO_ALERTS,
 classCEligibility,classCOpsRecords,classCDriverAssignment,classCShiftElapsed,
 classCStops,classCServiceDraft,classCDvirDraft,classCCostBreakdown,
} from '../src/lib/class-c-operations.js';
const vehicles=[
 {id:'v1',unit_number:'VAN-1',vehicle_type:'cargo_van',gvwr_lbs:9000,enabled:true},
 {id:'v2',unit_number:'BOX-2',vehicle_type:'box_truck',gvwr_lbs:25800,enabled:true},
 {id:'v3',unit_number:'BIG-3',vehicle_type:'box_truck',gvwr_lbs:30000,enabled:true},
 {id:'v4',unit_number:'SEMI-4',vehicle_type:'tractor',gvwr_lbs:40000,enabled:true},
 {id:'v5',unit_number:'PICK-5',vehicle_type:'pickup',enabled:false},
];
const drivers=[
 {user_id:'driverA',display_name:'Alex',license_class:'C'},
 {user_id:'driverB',display_name:'Bobby',license_class:'A'},
];
const assignments=[
 {id:'a1',driver_user_id:'driverA',vehicle_id:'v1',status:'in_transit',division:'Class C'},
 {id:'a2',driver_user_id:'driverB',vehicle_id:'v2',status:'accepted',division:'Class C'},
 {id:'a3',driver_user_id:'driverA',vehicle_id:'v3',status:'accepted',division:'Class C'},
 {id:'a4',driver_user_id:'driverB',vehicle_id:'v4',status:'in_transit',division:'CDL'},
];
test('Northvale reference covers all four workspaces and sample totals remain explicitly demo data',()=>{
 assert.deepEqual(NORTHVALE_TABS.map(t=>t.id),['dashboard','vehicles','service','analytics']);
 assert.equal(NORTHVALE_DEMO.summary.total,128);
 assert.equal(NORTHVALE_DEMO.summary.active,115);
 assert.equal(NORTHVALE_DEMO.summary.maintenance,15);
 assert.equal(NORTHVALE_DEMO.summary.criticalAlerts,28);
 assert.equal(NORTHVALE_DEMO.health.score,86);
 assert.equal(NORTHVALE_DEMO.health.criticalUnits+NORTHVALE_DEMO.health.needsAttention+NORTHVALE_DEMO.health.healthy,128);
 assert.equal(NORTHVALE_DEMO.service.today,24);
 assert.equal(NORTHVALE_DEMO.service.overdue,6);
 assert.equal(NORTHVALE_DEMO.monthCosts.actual,4592);
 assert.equal(NORTHVALE_DEMO.monthCosts.forecast,5100);
 assert.equal(NORTHVALE_DEMO.budgets.used/NORTHVALE_DEMO.budgets.budget,.9);
 assert.equal(Object.values(NORTHVALE_DEMO.operatingCosts).reduce((a,b)=>a+b,0),4592);
 assert.deepEqual(NORTHVALE_DEMO_VEHICLES.map(v=>v.unit_number),['TRK-104','VAN-021','TRK-107']);
 assert.equal(NORTHVALE_DEMO_SCHEDULE.length,5);
 assert.equal(NORTHVALE_DEMO_ALERTS.length,3);
});
test('Class C selection excludes 26,000+ GVWR and heavy tractors, flags missing GVWR',()=>{
 assert.equal(classCEligibility(vehicles[0]).eligible,true);
 assert.equal(classCEligibility(vehicles[1]).eligible,true);
 assert.equal(classCEligibility(vehicles[2]).eligible,false);
 assert.equal(classCEligibility(vehicles[3]).eligible,false);
 assert.equal(classCEligibility(vehicles[4]).verified,false);
 assert.match(classCEligibility(vehicles[4]).label,/not verified/);
 assert.equal(classCEligibility(null).eligible,false);
});
test('live Class C fleet KPIs are derived from actual accessible vehicles/assignments, not reference figures',()=>{
 const result=classCOpsRecords({vehicles,assignments,drivers,role:'admin'});
 assert.equal(result.counts.total,3);
 assert.equal(result.counts.active,2);
 assert.equal(result.counts.disabled,1);
 assert.equal(result.hasUnverifiedGvwr,true);
 assert.equal(result.assignments.length,2);
 assert.ok(result.vehicles.every(v=>v.id!=='v3'&&v.id!=='v4'));
});
test('driver can see only own linked Class C equipment, not other drivers vehicles',()=>{
 const result=classCOpsRecords({vehicles,assignments,drivers,role:'driver',currentUserId:'driverA'});
 assert.deepEqual(result.vehicles.map(v=>v.id),['v1']);
 assert.deepEqual(result.assignments.map(a=>a.id),['a1']);
 assert.deepEqual(result.drivers.map(d=>d.user_id),['driverA']);
 assert.equal(classCDriverAssignment({assignments,vehicles,currentUserId:'driverA'}).vehicle.id,'v1');
 assert.equal(classCDriverAssignment({assignments,vehicles,currentUserId:'unknown'}).vehicle,null);
});
test('shift elapsed cannot go negative, and counts Class C stop-related loads only',()=>{
 const start=Date.parse('2026-10-17T14:00:00Z');
 assert.equal(classCShiftElapsed(start,start+91*60000),91);
 assert.equal(classCShiftElapsed(start,start-10),0);
 assert.equal(classCShiftElapsed(NaN,start),0);
 assert.equal(classCStops(assignments,'driverA').length,2);
 assert.equal(classCStops(assignments,'driverB').length,1);
});
test('service modal validates real form shapes and does not let invalid appointments through',()=>{
 const draft=classCServiceDraft({unit:'VAN-1',job:'Brake inspection',day:2,time:'08:30',bay:'Bay A'});
 assert.deepEqual(draft,{valid:true,unit:'VAN-1',job:'Brake inspection',day:2,time:'08:30',bay:'Bay A',state:'Scheduled'});
 assert.equal(classCServiceDraft({unit:'',job:'Brake inspection',day:0,time:'08:30'}).valid,false);
 assert.equal(classCServiceDraft({unit:'VAN-1',job:'A',day:0,time:'08:30'}).valid,false);
 assert.equal(classCServiceDraft({unit:'VAN-1',job:'Brake inspection',day:5,time:'08:30'}).valid,false);
 assert.equal(classCServiceDraft({unit:'VAN-1',job:'Brake inspection',day:0,time:'25:22'}).valid,false);
});
test('DVIR is explicitly an unsubmitted local draft, never silently reports to fleet maintenance',()=>{
 const draft=classCDvirDraft({unit:'VAN-1',driverId:'driverA',
   defect:'Brake system',severity:'out-of-service',note:'Brake pedal feels soft',
   time:'2026-10-17T14:00:00Z'});
 assert.equal(draft.valid,true);
 assert.equal(draft.status,'LOCAL DRAFT — NOT SUBMITTED');
 assert.equal(draft.severity,'out-of-service');
 assert.equal(draft.driverId,'driverA');
 assert.equal(classCDvirDraft({unit:'VAN-1'}).valid,false);
 assert.equal(classCDvirDraft({unit:'',defect:'Brake system'}).valid,false);
 assert.equal(classCDvirDraft({unit:'VAN-1',defect:'Brake system',severity:'safety-clear'}).valid,false);
});
test('cost breakdown uses input values only and no fabricated live expense values',()=>{
 assert.deepEqual(classCCostBreakdown({Fuel:1850,Maintenance:1480,Other:0}),
   [{label:'Fuel',value:1850},{label:'Maintenance',value:1480}]);
 assert.deepEqual(classCCostBreakdown({}),[]);
});
