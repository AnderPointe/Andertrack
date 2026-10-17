import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJourney, journeyMilestones, journeySchedule, journeyCsv } from '../src/lib/shipment-journey.js';

const t0='2026-10-17T10:00:00Z';
const load={id:'load1',reference:'AT-601',created_at:t0,status:'in_transit',scheduled_delivery_at:'2026-10-17T14:00:00Z'};
const event=(id,action,time,other={})=>({
 id,assignment_id:'load1',action,occurred_at:time,previous_status:'accepted',next_status:'in_transit',actor_user_id:'u1',...other,
});
const assigned=[event('offer','offer','2026-10-17T10:10:00Z'),
 event('accept','accept','2026-10-17T10:15:00Z'),
 event('pickup','pickup','2026-10-17T10:45:00Z'),
 event('transit','start_transit','2026-10-17T11:00:00Z')];
const scan={id:'scan1',assignment_id:'load1',package_id:'package1',action:'pickup',scanned_at:'2026-10-17T10:47:00Z',actor_user_id:'u1'};

test('timeline uses actual audit rows, private proof metadata and chronological ordering',()=>{
 const entries=buildJourney({assignment:load,assignmentEvents:assigned,
   packageEvents:[scan],proof:{id:'proof1',confirmed_at:'2026-10-17T11:20:00Z'},
   packageLabels:{package1:'PKG-102'}});
 assert.equal(entries.length,7);
 assert.equal(entries[0].kind,'proof');
 assert.equal(entries[1].title,'Departed for delivery');
 assert.equal(entries.find(e=>e.kind==='package').detail,'Tracking: PKG-102');
 assert.ok(entries.some(e=>e.title==='Shipment created'));
 assert.ok(entries.every((e,i)=>i===0||Date.parse(entries[i-1].timestamp)>=Date.parse(e.timestamp)));
 assert.ok(entries.every(e=>!('recipient_name' in e)&&!('evidence_path' in e)));
});

test('other assignment events and invalid timestamps never appear',()=>{
 const rows=buildJourney({assignment:load,assignmentEvents:[
  event('other','deliver','2026-10-17T12:00:00Z',{assignment_id:'another-load'}),
  event('invalid','deliver','invalid'),...assigned]});
 assert.equal(rows.length,5);
 assert.equal(rows.filter(e=>e.action==='deliver').length,0);
});
test('milestones show only recorded events rather than inferring from current status',()=>{
 const milestones=journeyMilestones(load,[assigned[0],assigned[1]]);
 assert.deepEqual(milestones.filter(m=>m.complete).map(m=>m.id),['created','offer','accept']);
 assert.equal(milestones.find(m=>m.id==='start_transit').complete,false);
 assert.equal(milestones.find(m=>m.id==='deliver').complete,false);
 const other=journeyMilestones({...load,status:'delivered'},[]);
 assert.deepEqual(other.filter(m=>m.complete).map(m=>m.id),['created']);
});

test('schedule warning uses real due time and does not claim on-time delivery',()=>{
 const base=Date.parse('2026-10-17T12:00:00Z');
 assert.equal(journeySchedule(load,base).kind,'near');
 assert.equal(journeySchedule(load,base-4*3600_000).kind,'scheduled');
 assert.equal(journeySchedule(load,base+4*3600_000).kind,'late');
 assert.equal(journeySchedule({...load,status:'delivered'},base+4*3600_000).kind,'recorded');
 assert.equal(journeySchedule({...load,scheduled_delivery_at:null},base).kind,'unset');
 assert.ok(!journeySchedule(load,base).label.toLowerCase().includes('eta'));
});

test('CSV exports only visible event fields and neutralizes spreadsheet formulas',()=>{
 const entries=[{
  timestamp:'2026-10-17T11:00:00Z',kind:'package',
  title:'=HYPERLINK("https://bad.test")',detail:'\t+CMD(1,2)',
 }];
 const csv=journeyCsv(entries);
 assert.ok(csv.startsWith('"Timestamp UTC","Category"'));
 assert.ok(csv.includes('"\'=HYPERLINK(""https://bad.test"")"'));
 assert.ok(csv.includes('"\'\t+CMD(1,2)"'));
 assert.equal(csv.split('\r\n').length,2);
 assert.ok(!csv.includes('secret_evidence_path'));
});

test('empty or incomplete records return no invented event history',()=>{
 assert.deepEqual(buildJourney({}),[]);
 assert.deepEqual(buildJourney({assignment:{id:'load'}}),[]);
 assert.deepEqual(journeyMilestones({id:'load'},[]).filter(m=>m.complete),[]);
});
