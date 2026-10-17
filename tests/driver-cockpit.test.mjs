import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_PEOPLE,DUTY_STATES,safeDutyLog,setDemoDutySlot,formatHrsMinutes,
  demoHosGauges,moneyTotal,visibleDriverAssignments,cockpitRouteUrl,
} from '../src/lib/driver-cockpit.js';

test('three cockpit personas are explicitly sample profiles with separate CDL/Local roles',()=>{
 assert.equal(DEMO_PEOPLE.length,3);
 assert.deepEqual(DEMO_PEOPLE.map(d=>d.name),['Jameson Doe','Oliver Smith','Michael R.']);
 assert.ok(DEMO_PEOPLE.every(d=>d.id.startsWith('sample-')||d.id.startsWith('sample')));
 assert.equal(DEMO_PEOPLE.filter(d=>d.role==='CDL').length,2);
 assert.equal(DEMO_PEOPLE.filter(d=>d.role==='Local').length,1);
});
test('24-hour ELD illustration contains exactly 96 quarter-hour slots',()=>{
 const cells=safeDutyLog(DEMO_PEOPLE[0].log);
 assert.equal(cells.length,96);
 assert.ok(cells.every(s=>DUTY_STATES.some(d=>d.id===s)));
 assert.equal(cells[0],'OFF');
 assert.equal(cells[26],'ON');
 assert.equal(cells[30],'D');
});
test('changing demo duty status modifies only one illustration cell',()=>{
 const log=DEMO_PEOPLE[0].log;
 const before=safeDutyLog(log);
 const after=setDemoDutySlot(log,'SB',95);
 assert.equal(after.length,96);
 assert.equal(after[95],'SB');
 assert.deepEqual(after.slice(0,95),before.slice(0,95));
 assert.deepEqual(setDemoDutySlot(log,'fake',95),before);
});
test('sample HOS clocks clamp to safe nonnegative values without regulatory assertion',()=>{
 const gauges=demoHosGauges(DEMO_PEOPLE[0].hos);
 assert.equal(gauges.length,4);
 assert.equal(gauges[0].max,660);
 assert.equal(gauges[1].max,840);
 assert.equal(gauges[3].max,4200);
 assert.ok(gauges.every(g=>g.remaining>=0&&g.pct>=0&&g.pct<=100));
 assert.equal(formatHrsMinutes(86),'01:26');
 assert.equal(formatHrsMinutes(0),'00:00');
 assert.equal(formatHrsMinutes(Infinity),'—');
 assert.deepEqual(demoHosGauges(null),[]);
});
test('wallet totals are illustrative sums, not real payout instructions',()=>{
 assert.equal(moneyTotal({base:100,stops:20,detention:5,tips:10,bonus:3}),138);
 assert.equal(moneyTotal({base:-50,stops:30,tips:NaN}),30);
 assert.equal(moneyTotal({}),0);
});
test('live driver assignment selection must match their own authenticated user ID',()=>{
 const loads=[
  {id:'own',driver_user_id:'driverA',status:'in_transit'},
  {id:'other',driver_user_id:'driverB',status:'accepted'},
  {id:'none',driver_user_id:null,status:'unassigned'},
 ];
 assert.deepEqual(visibleDriverAssignments(loads,'driver','driverA').map(x=>x.id),['own']);
 assert.deepEqual(visibleDriverAssignments(loads,'admin','driverA'),[]);
 assert.deepEqual(visibleDriverAssignments(loads,'driver',''),[]);
});
test('external destination handoff does not claim embedded navigation or actual ETA',()=>{
 assert.equal(cockpitRouteUrl({dropoff_address:'Burleson, TX'}),
  'https://www.google.com/maps/search/?api=1&query=Burleson%2C%20TX');
 assert.equal(cockpitRouteUrl({dropoff_address:''}),null);
 assert.equal(cockpitRouteUrl(null),null);
 assert.ok(!cockpitRouteUrl({dropoff_address:'Fort Worth TX'}).includes('eta'));
});
