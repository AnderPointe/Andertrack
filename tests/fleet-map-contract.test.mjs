import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/live/FleetMap.jsx', import.meta.url),'utf8');

test('FleetMap has no unresolved merge-conflict markers', () => {
  assert.doesNotMatch(source, /^(<{7}|={7}|>{7})(?:\s|$)/m);
});

test('unified map keeps modern and Phase 4 props', () => {
  for (const prop of ['theme', 'onChoose', 'className', 'error', 'loading']) {
    assert.ok(new RegExp('\\b'+prop+'\\b').test(source), 'Missing '+prop);
  }
});

test('map validates GPS, labels data safely, and avoids resetting pan/zoom on updates', () => {
  assert.ok(source.includes('filter(validGpsPosition)'));
  assert.ok(source.includes('freshGpsPosition(point)'));
  assert.ok(source.includes('textContent = point.unit_number'));
  assert.ok(source.includes('!fittedRef.current && points.length'));
  assert.ok(source.includes('marker-color'));
});
