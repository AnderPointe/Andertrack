import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeTelemetryTick, telemetryLocations} from '../src/lib/eld-telemetry.js';
const sample = {truck_id:'TRK-018', current_speed_kmh:72.5, latitude:40.7, longitude:-74};
const normalizeTelemetry = (input, organizationId) => ({...input,organization_id:organizationId,updated_at:new Date().toISOString()});
test('client rejects foreign, invalid and older ticks', () => {
  const tick=normalizeTelemetry(sample,'org');
  const state=mergeTelemetryTick({},tick,'org');
  assert.equal(mergeTelemetryTick(state,{...tick,organization_id:'other'},'org'),state);
  assert.equal(mergeTelemetryTick(state,{...tick,latitude:NaN},'org'),state);
  assert.equal(mergeTelemetryTick(state,{...tick,updated_at:'2020-01-01'},'org'),state);
});
test('map associates only scoped inventory with an unambiguous active driver', () => {
  const tick=normalizeTelemetry(sample,'org');
  const args={ticks:{'TRK-018':tick},vehicles:[{id:'v',unit_number:'TRK-018'}],
    assignments:[{vehicle_id:'v',driver_user_id:'d',status:'in_transit'}],organizationId:'org',locations:[]};
  const [point]=telemetryLocations(args);
  assert.equal(point.driver_id,'d'); assert.equal(point.latitude,40.7);
  const phone = {...point,id:'phone',last_ping_at:new Date(Date.now()+1000).toISOString()};
  assert.deepEqual(telemetryLocations({...args,locations:[phone]}),[phone]);
  assert.equal(telemetryLocations({...args,organizationId:'other'}).length,0);
  assert.equal(telemetryLocations({...args,assignments:[]}).length,0);
  assert.equal(telemetryLocations({...args,assignments:[...args.assignments,{vehicle_id:'v',driver_user_id:'other',status:'in_transit'}]}).length,0);
});
