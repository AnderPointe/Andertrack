import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTelemetry, createPipeline} from '../services/telemetry/core.mjs';
import {mergeTelemetryTick, telemetryLocations} from '../src/lib/eld-telemetry.js';
const sample = {truck_id:'TRK-018', speed_kmh:72.5, fuel_pct:64, odometer_km:183420.2, lon:-74, lat:40.7};
test('normalization preserves decimals, fixes tenant and receipt time, constructs PointZ', () => {
  const tick = normalizeTelemetry({...sample, organization_id:'evil', driver_id:'spoof'}, 'org', new Date('2026-01-01'));
  assert.equal(tick.current_speed_kmh, 72.5);
  assert.equal(tick.organization_id, 'org');
  assert.equal(tick.point_wkt, 'SRID=4326;POINT Z (-74 40.7 0)');
  assert.equal(tick.driver_id, undefined);
  assert.equal(tick.updated_at, '2026-01-01T00:00:00.000Z');
});
test('invalid and missing payloads fail closed', () => {
  for (const bad of [null, [], {}, {...sample,truck_id:18}, {...sample,lat:91}, {...sample,lon:-181},
    {...sample,fuel_pct:101}, {...sample,odometer_km:-1}, {...sample,speed_kmh:'72'}, {...sample,alt:Infinity}]) {
    assert.throws(() => normalizeTelemetry(bad, 'org'));
  }
});
test('broadcast uses private envelope and state coalesces duplicate truck keys', async () => {
  const calls=[];
  const p=createPipeline({organizationId:'org',send:async (...args)=>calls.push(args)});
  await p.ingest(sample); await p.ingest({...sample,speed_kmh:80});
  assert.equal(p.size,1);
  assert.equal(calls[0][1].messages[0].private,true);
  assert.equal(calls[0][1].messages[0].topic,'telemetry:org');
  await p.flush();
  assert.equal(calls[2][1].p_ticks.length,1);
  assert.equal(calls[2][1].p_ticks[0].current_speed_kmh,80);
  assert.equal(p.size,0);
});
test('failed broadcasts and flushes retain bounded retry state', async () => {
  let fail=true;
  const p=createPipeline({organizationId:'org',maxTrucks:1,send:async ()=>{if(fail)throw Error('offline');}});
  await assert.rejects(p.ingest(sample));
  await assert.rejects(p.flush()); assert.equal(p.size,1);
  await assert.rejects(p.ingest({...sample,truck_id:'TRK-019'}),/full/);
  fail=false; await p.flush(); assert.equal(p.size,0);
});
test('flush does not clear a newer tick arriving during persistence', async () => {
  let release;
  const p=createPipeline({organizationId:'org',send:async path=>{
    if(path.includes('/rpc/')) await new Promise(resolve=>{release=resolve;});
  }});
  await p.ingest(sample);
  const flushing=p.flush();
  assert.equal(p.flush(),flushing);
  await p.ingest({...sample,speed_kmh:81});
  release(); await flushing;
  assert.equal(p.size,1);
});
test('flush batch is capped at 50 distinct units', async () => {
  const batches=[];
  const p=createPipeline({organizationId:'org',send:async (path,body)=>{if(body.p_ticks)batches.push(body.p_ticks);}});
  for(let i=0;i<51;i++) await p.ingest({...sample,truck_id:`TRK-${i}`});
  await p.flush(); assert.equal(batches[0].length,50); assert.equal(p.size,1);
});
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

test('HTTP collector rejects unauthorized, wrong content type and invalid JSON before upstream calls', async () => {
  const {spawn} = await import('node:child_process');
  const {randomBytes} = await import('node:crypto');
  const {createServer} = await import('node:net');
  const listener=createServer();
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  const token=randomBytes(32).toString('hex');
  const child=spawn(process.execPath,['services/telemetry/server.mjs'],{
    env:{...process.env,PORT:String(port),SUPABASE_URL:'https://example.invalid',
      SUPABASE_SERVICE_ROLE_KEY:randomBytes(32).toString('hex'),TELEMETRY_INGEST_TOKEN:token,
      TELEMETRY_ORGANIZATION_ID:'00000000-0000-0000-0000-000000000001'},stdio:'ignore',
  });
  const base=`http://127.0.0.1:${port}`;
  try {
    let ready=false;
    for(let i=0;i<100;i++) {
      try {await fetch(base);ready=true;break;} catch {await new Promise(resolve=>setTimeout(resolve,20));}
    }
    assert.equal(ready,true);
    assert.equal((await fetch(`${base}/telemetry`,{method:'POST'})).status,401);
    const headers={Authorization:`Bearer ${token}`};
    assert.equal((await fetch(`${base}/telemetry`,{method:'POST',headers,body:'x'})).status,415);
    headers['Content-Type']='application/json';
    assert.equal((await fetch(`${base}/telemetry`,{method:'POST',headers,body:'not-json'})).status,400);
    assert.equal((await fetch(`${base}/telemetry`,{method:'POST',headers,body:JSON.stringify({...sample,lat:999})})).status,400);
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve=>child.once('exit',resolve));
  }
});
