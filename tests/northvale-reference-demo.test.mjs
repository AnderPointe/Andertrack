import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 NORTHVALE_REFERENCE_VEHICLES,NORTHVALE_REFERENCE_ALERTS,
 NORTHVALE_REFERENCE_SCHEDULE,NORTHVALE_REFERENCE_FORECAST,
 northvaleDemoVehicle,northvaleHotspots,northvaleMonth,
} from '../src/lib/northvale-reference-demo.js';
import {classCEligibility} from '../src/lib/class-c-operations.js';

test('uploaded Northvale example provides all six distinct mock Class C vehicles',()=>{
 assert.deepEqual(NORTHVALE_REFERENCE_VEHICLES.map(v=>v.unit_number),
   ['TRK-104','TRK-107','VAN-021','TRK-115','BUS-150','TRK-201']);
 assert.equal(new Set(NORTHVALE_REFERENCE_VEHICLES.map(v=>v.id)).size,6);
 assert.equal(northvaleDemoVehicle('VAN-021').demoDriver,'Oliver Smith');
 assert.equal(northvaleDemoVehicle('TRK-104').model,'Prado');
 assert.equal(northvaleDemoVehicle('UNKNOWN'),null);
 assert.ok(NORTHVALE_REFERENCE_VEHICLES.every(v=>classCEligibility(v).category));
 assert.ok(NORTHVALE_REFERENCE_VEHICLES.every(v=>v.gvwr_lbs>0&&v.gvwr_lbs<26000));
});
test('vehicle-specific example health hotspots remain synthetic and keyed to unit',()=>{
 const prado=northvaleHotspots('TRK-104');
 assert.equal(prado.length,4);
 assert.equal(prado.find(x=>x.id==='rl-tire').severity,'critical');
 assert.equal(northvaleHotspots('VAN-021').length,2);
 assert.equal(northvaleHotspots('BUS-150').length,0);
 assert.equal(northvaleHotspots('DOES-NOT-EXIST').length,0);
 assert.ok(NORTHVALE_REFERENCE_VEHICLES.every(v=>
   v.hotspots.every(h=>h.x>=0&&h.x<=100&&h.y>=0&&h.y<=100)));
});
test('the interactive forecast preserves all twelve source demo months',()=>{
 assert.equal(NORTHVALE_REFERENCE_FORECAST.length,12);
 assert.deepEqual(NORTHVALE_REFERENCE_FORECAST.map(x=>x.month),
  ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
 assert.deepEqual(northvaleMonth(5),{month:'Jun',actual:4592,forecast:5100});
 assert.equal(northvaleMonth(999).month,'Jun');
});
test('sample planner and recent alerts contain the source-defined workshop metadata',()=>{
 assert.equal(NORTHVALE_REFERENCE_SCHEDULE.length,8);
 assert.equal(NORTHVALE_REFERENCE_SCHEDULE.filter(x=>x.day===0).length,2);
 assert.equal(NORTHVALE_REFERENCE_SCHEDULE[0].bay,'AutoCare Workshop');
 assert.ok(NORTHVALE_REFERENCE_SCHEDULE.every(x=>x.day>=0&&x.day<=4&&x.time));
 assert.equal(NORTHVALE_REFERENCE_ALERTS.length,5);
 assert.equal(NORTHVALE_REFERENCE_ALERTS[0].severity,'critical');
 assert.ok(NORTHVALE_REFERENCE_ALERTS.every(a=>a.source.startsWith('Synthetic')));
});
