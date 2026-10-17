import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validGpsPosition, freshGpsPosition, visibleShipments, selectedVisibleShipment } from '../src/lib/operations.js';

test('GPS never treats missing or nonfinite coordinates as real locations', () => {
  for (const position of [
    {}, {latitude: null,longitude: 0}, {latitude: '',longitude: 0},
    {latitude: NaN,longitude: 22}, {latitude: 91,longitude: 0},
    {latitude: 0,longitude: -181}, {latitude: 1,longitude: Infinity},
  ]) assert.equal(validGpsPosition(position), false);
  assert.equal(validGpsPosition({latitude: 32.74,longitude:-97.33}),true);
  assert.equal(validGpsPosition({latitude: 0,longitude:0}),true);
});

test('freshness distinguishes recent, future and stale pings', () => {
  const now=Date.parse('2026-10-17T12:00:00Z');
  const row=last_ping_at=>({latitude:30.2,longitude:-97.4,last_ping_at});
  assert.equal(freshGpsPosition(row('2026-10-17T11:58:10Z'),now),true);
  assert.equal(freshGpsPosition(row('2026-10-17T11:54:00Z'),now),false);
  assert.equal(freshGpsPosition(row('2026-10-17T12:01:00Z'),now),false);
  assert.equal(freshGpsPosition(row('not a time'),now),false);
  assert.equal(freshGpsPosition({latitude:null,longitude:-97.4,last_ping_at:'2026-10-17T11:59:00Z'},now),false);
});

const jobs=[
 {id:'a',reference:'AT-1001',customer_name:'Western',pickup_address:'Midland, TX',dropoff_address:'Odessa, TX',division:'CDL',status:'in_transit'},
 {id:'b',reference:'AT-1002',customer_name:'Northstar',pickup_address:'Dallas, TX',dropoff_address:'Irving, TX',division:'Class C',status:'unassigned'},
 {id:'c',reference:'AT-1003',customer_name:'Western',pickup_address:'Lubbock, TX',dropoff_address:'Midland, TX',division:'CDL',status:'delivered'},
];

test('shipment filters respect status and case-insensitive search',()=>{
  assert.deepEqual(visibleShipments(jobs,'active').map(x=>x.id),['a']);
  assert.deepEqual(visibleShipments(jobs,'pending').map(x=>x.id),['b']);
  assert.deepEqual(visibleShipments(jobs,'delivered').map(x=>x.id),['c']);
  assert.deepEqual(visibleShipments(jobs,'all','WESTERN').map(x=>x.id),['a','c']);
  assert.deepEqual(visibleShipments(jobs,'all','Odessa').map(x=>x.id),['a']);
  assert.deepEqual(visibleShipments(jobs,'delivered','Dallas'),[]);
});

test('selection never references hidden shipment when filtered',()=>{
  const shown=visibleShipments(jobs,'pending');
  assert.equal(selectedVisibleShipment(shown,'a').id,'b');
  assert.equal(selectedVisibleShipment(shown,'b').id,'b');
  assert.equal(selectedVisibleShipment([],'a'),null);
});
