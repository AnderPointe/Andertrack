import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveOperationalAlerts,deriveActivityStream,shipmentCsv } from '../src/lib/command-intelligence.js';
const at=Date.parse('2026-10-17T12:00:00Z');
const old=m=>new Date(at-m*60000).toISOString();
const input={
 assignments:[
  {id:'a',reference:'AT-7',status:'unassigned',customer_name:'Acme',created_at:old(80),pickup_address:'Dallas'},
  {id:'b',reference:'AT-8',status:'accepted',created_at:old(50)},
  {id:'c',reference:'AT-9',status:'unassigned',created_at:old(4)},
 ],
 requests:[
  {id:'req1',driver_user_id:'driver1',status:'queued',queue_number:1,requested_at:old(40)},
  {id:'req2',driver_user_id:'driver2',status:'queued',queue_number:2,requested_at:old(3)},
 ],
 drivers:[{user_id:'driver1',display_name:'Driver One',license_verified:false,availability:'available'}],
 locations:[
  {id:'gps1',unit_number:'Unit 1',latitude:32.7,longitude:-97.3,last_ping_at:old(70)},
  {id:'gps2',unit_number:'Unit 2',latitude:32.7,longitude:-97.3,last_ping_at:old(2)},
  {id:'gps3',unit_number:'Unit 3',latitude:null,longitude:12,last_ping_at:old(2)},
 ],
};
test('triage detects explainable issues only above thresholds',()=>{
  const alerts=deriveOperationalAlerts(input,at);
  assert.deepEqual(alerts.filter(x=>x.severity==='high').map(x=>x.id),['stale-gps:gps1','queue:req1']); // oldest high-severity signal first
  assert.ok(alerts.some(x=>x.id==='unassigned:a'&&x.assignmentId==='a'));
  assert.ok(alerts.some(x=>x.id==='license:driver1'));
  assert.ok(alerts.some(x=>x.id==='invalid-gps:gps3'));
  assert.ok(!alerts.some(x=>x.id==='unassigned:c'));
  assert.ok(!alerts.some(x=>x.id==='queue:req2'));
  assert.ok(!alerts.some(x=>x.id==='stale-gps:gps2'));
});
test('drivers never see dispatch-only or another drivers issues',()=>{
  const alerts=deriveOperationalAlerts({...input,planner:false,userId:'driver1'},at);
  assert.deepEqual(alerts.map(x=>x.id),['queue:req1']);
});
test('no data generates no fabricated exception',()=>{
  assert.deepEqual(deriveOperationalAlerts({},at),[]);
  assert.deepEqual(deriveActivityStream({},at),[]);
});
test('timestamps never pretend current status is a historical transition',()=>{
  const items=deriveActivityStream(input,at);
  assert.equal(items[0].title,'GPS reported');
  assert.ok(items.some(x=>x.title==='Load created'));
  assert.ok(items.every(x=>x.title!=='Delivered'));
  assert.ok(items.every((x,i)=>i===0||Date.parse(items[i-1].at)>=Date.parse(x.at)));
});
test('CSV safely quotes values and prefixes spreadsheet formula payloads',()=>{
  const csv=shipmentCsv([{reference:'AT-1',customer_name:'=HYPERLINK("http://bad.test")',pickup_address:'+SUM(1,2)',dropoff_address:'-1',commodity:'Normal, quoted',status:'unassigned'}]);
  assert.ok(csv.startsWith('"Reference","Customer"'));
  assert.ok(csv.includes('\''+'=HYPERLINK(""http://bad.test"")'));
  assert.ok(csv.includes('"\'+SUM(1,2)"'));
  assert.ok(csv.includes('"\'-1"'));
  assert.ok(csv.includes('"Normal, quoted"'));
});
