import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_CHECKLIST,dutySlotToTime,summarizeDutySlots,dutySegmentsFromSlots,
  paintDutyRange,payrollScenario,jurisdictionReconciliation,proofReadiness,dutyScenarioCsv,
  nextDriverMissionStatus,liveDriverMissionCounts,
} from '../src/lib/driver-cockpit-pro.js';
import {DEMO_PEOPLE,safeDutyLog} from '../src/lib/driver-cockpit.js';

const original=()=>safeDutyLog(DEMO_PEOPLE[0].log);
test('a complete 96-block demo duty log accurately accounts for 24 hours',()=>{
  const entries=original();
  const totals=summarizeDutySlots(entries);
  assert.equal(entries.length,96);
  assert.equal(totals.totalMinutes,1440);
  assert.equal(totals.OFF+totals.SB+totals.D+totals.ON,1440);
  assert.ok(totals.transitions>0);
  const ledger=dutySegmentsFromSlots(entries);
  assert.equal(ledger[0].start,'00:00');
  assert.equal(ledger.at(-1).end,'24:00');
  assert.equal(ledger.reduce((sum,e)=>sum+e.durationMinutes,0),1440);
  assert.equal(dutySlotToTime(32),'08:00');
  assert.equal(dutySlotToTime(95),'23:45');
  assert.equal(dutySlotToTime(96),'—');
});
test('duty editor paints a precise time range without mutating the original',()=>{
  const log=original();
  const edited=paintDutyRange(log,40,4,'ON');
  assert.equal(edited[40],'ON');
  assert.equal(edited[43],'ON');
  assert.equal(edited[44],log[44]);
  assert.deepEqual(log,original());
  assert.deepEqual(paintDutyRange(log,98,2,'D'),log);
  assert.deepEqual(paintDutyRange(log,40,0,'D'),log);
  assert.deepEqual(paintDutyRange(log,40,2,'INVALID'),log);
  const end=paintDutyRange(log,95,8,'D');
  assert.equal(end.length,96);
  assert.equal(end[95],'D');
});
test('pay what-if simulator adds illustrative stops tips and detention; clamps bad values',()=>{
  const base={base:100,stops:22,tips:10,detention:5,bonus:0};
  const r=payrollScenario(base,{stops:4,perStop:18,tipDelta:12,detentionMinutes:90,detentionHourly:30});
  assert.equal(r.initial,137);
  assert.equal(r.extraStopPay,72);
  assert.equal(r.extraDetentionPay,45);
  assert.equal(r.total,266);
  assert.equal(r.added,129);
  assert.equal(payrollScenario(base,{stops:-3,tipDelta:-5,detentionMinutes:-10}).total,137);
  assert.equal(payrollScenario(base,{stops:999,perStop:10,tipDelta:0,detentionMinutes:0}).extraStopPay,300);
  assert.equal(payrollScenario({base:NaN,tips:-7},{}).initial,0);
});
test('state mileage auditor exposes discrepancies and validates input',()=>{
  const okay=jurisdictionReconciliation([['TX',197],['NM',66]],263);
  assert.equal(okay.matched,true);
  assert.equal(okay.differenceMiles,0);
  const bad=jurisdictionReconciliation([['TX',201],['NM',68]],263);
  assert.equal(bad.matched,false);
  assert.equal(bad.differenceMiles,6);
  assert.equal(jurisdictionReconciliation([['TX',-99]],10).stateTotalMiles,0);
  assert.equal(jurisdictionReconciliation([['TX',12]],null).tripTotalMiles,0);
});
test('example delivery completion requires every checkpoint and sample recipient',()=>{
  const ids=DEMO_CHECKLIST.map(x=>x.id);
  assert.equal(ids.length,4);
  assert.equal(proofReadiness(ids,'').ready,false);
  assert.equal(proofReadiness(ids.slice(0,3),'Sample Customer').ready,false);
  assert.equal(proofReadiness(ids,'A').ready,false);
  assert.deepEqual(proofReadiness(ids,'Sample Customer'),{
    completed:4,total:4,hasRecipient:true,ready:true,
  });
});
test('export CSV is prominently sample-only and spreadsheet-formula safe',()=>{
  const csv=dutyScenarioCsv([{
    start:'08:00',end:'09:00',status:'D',durationMinutes:60,
  }],'=SUSPICIOUS()');
  assert.ok(csv.includes('SIMULATED - NOT AN ELD RECORD'));
  assert.ok(csv.includes("'=SUSPICIOUS()"));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(csv.trim().split('\r\n').length,2);
});

test('live mission state tracks only recorded assignment and scheduled due time',()=>{
 const current=Date.parse('2026-10-17T12:00:00Z');
 const assigned={id:'a',status:'in_transit',scheduled_delivery_at:'2026-10-17T13:00:00Z'};
 let status=nextDriverMissionStatus(assigned,current);
 assert.equal(status.label,'Deliver and capture proof');
 assert.equal(status.scheduleKind,'approaching');
 assert.equal(nextDriverMissionStatus(assigned,current+7200000).scheduleKind,'past-due');
 assert.equal(nextDriverMissionStatus({...assigned,status:'delivered'},current+7200000).scheduleKind,'completed');
 assert.equal(nextDriverMissionStatus({...assigned,scheduled_delivery_at:null}).scheduleKind,'unscheduled');
 assert.equal(nextDriverMissionStatus({status:'offered'}).label,'Offer awaiting decision');
});
test('mission counters use only supplied permitted assignments and do not invent trips',()=>{
 assert.deepEqual(liveDriverMissionCounts([]),{total:0,active:0,offers:0,delivered:0});
 assert.deepEqual(liveDriverMissionCounts([
  {status:'offered'},{status:'accepted'},{status:'in_transit'},
  {status:'delivered'},{status:'cancelled'},
 ]),{total:5,active:2,offers:1,delivered:1});
});
