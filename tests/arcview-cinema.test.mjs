import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  CINEMA_COMMANDS,normalizeCinemaCommand,parseCinemaCommand,
  cinemaSafety,cinemaDiagnostics,cockpitCinemaAccess,
} from '../src/lib/arcview-cinema.js';
import {hudSnapshot} from '../src/lib/holographic-hud.js';

test('cinematic commands whitelist only read-only display actions',()=>{
 const allowed=['map','diagnostics','mission','center','pause','resume','help','exit'];
 assert.deepEqual(CINEMA_COMMANDS.map(c=>c.id),allowed);
 for(const command of CINEMA_COMMANDS)
   for(const example of command.examples)
     assert.deepEqual(parseCinemaCommand(example),{id:command.id,error:null});
 assert.equal(parseCinemaCommand('  SHOW, MAP! ').id,'map');
 assert.equal(normalizeCinemaCommand(' ReCenter   Map!!! '),'recenter map');
});
test('unrecognized commands never advance dispatch or move money',()=>{
 for(const phrase of ['accept load','confirm delivery','instant cash out','drive to Odessa','start engine',
                       'toggle elD on','pay the driver','navigate to interstate','']) {
   const result=parseCinemaCommand(phrase);
   assert.equal(result.id,null);
   assert.ok(result.error.length>0);
 }
});
test('live moving vehicles lock motion and voice; no GPS is not permission to listen',()=>{
 assert.deepEqual(cinemaSafety({isDemo:true}),{
   moving:false,stationaryConfirmed:true,allowVoice:true,allowEffects:true,reason:'Sample dashboard',
 });
 let x=cinemaSafety({isDemo:false,gpsFresh:true,speed:42});
 assert.equal(x.allowVoice,false);
 assert.equal(x.allowEffects,false);
 assert.equal(x.moving,true);
 x=cinemaSafety({isDemo:false,gpsFresh:false,speed:null});
 assert.equal(x.allowVoice,false);
 assert.equal(x.stationaryConfirmed,false);
 x=cinemaSafety({isDemo:false,gpsFresh:true,speed:0});
 assert.equal(x.stationaryConfirmed,true);
 assert.equal(x.allowVoice,true);
 x=cinemaSafety({isDemo:false,gpsFresh:true,speed:null});
 assert.equal(x.allowVoice,false);
});
test('missing telemetry yields explicit not-connected diagnostics',()=>{
 const snap=hudSnapshot({location:null});
 const metrics=cinemaDiagnostics(snap,null);
 assert.ok(metrics.some(x=>x.id==='engine'&&x.value==='NOT CONNECTED'));
 assert.ok(metrics.some(x=>x.id==='eld'&&x.value==='NOT CONNECTED'));
 assert.ok(metrics.some(x=>x.id==='position'&&x.value==='UNAVAILABLE'));
 assert.ok(metrics.some(x=>x.id==='speed'&&x.value==='—'));
 assert.ok(metrics.some(x=>x.id==='signal'&&x.value==='—'));
});
test('reported signal is shown only when GPS is fresh',()=>{
 const source={signal_strength:-77};
 const fresh=cinemaDiagnostics({gpsFresh:true,speed:37,accuracy:6,battery:88},source);
 assert.equal(fresh.find(x=>x.id==='signal').value,'-77');
 assert.equal(fresh.find(x=>x.id==='speed').value,'37 mph');
 const stale=cinemaDiagnostics({gpsFresh:false,speed:null,accuracy:null,battery:null},source);
 assert.equal(stale.find(x=>x.id==='signal').value,'—');
});
test('commands have bounded length and do not accept arbitrary strings',()=>{
 const huge='show map'.repeat(500);
 assert.ok(normalizeCinemaCommand(huge).length<=120);
 assert.equal(parseCinemaCommand(huge).id,null);
});

test('cockpit launch is accessible to admins only as an explicitly sample-only workspace',()=>{
  assert.deepEqual(cockpitCinemaAccess({isDemo:true,role:'admin'}),
    {visible:true,liveDriver:false,sampleOnly:true});
  assert.deepEqual(cockpitCinemaAccess({isDemo:false,role:'dispatcher'}),
    {visible:true,liveDriver:false,sampleOnly:true});
  assert.deepEqual(cockpitCinemaAccess({isDemo:false,role:'admin'}),
    {visible:true,liveDriver:false,sampleOnly:true});
  assert.deepEqual(cockpitCinemaAccess({isDemo:false,role:'driver'}),
    {visible:true,liveDriver:true,sampleOnly:false});
  assert.deepEqual(cockpitCinemaAccess({isDemo:false,role:'unapproved'}),
    {visible:false,liveDriver:false,sampleOnly:false});
});
