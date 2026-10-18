import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const path=fileURLToPath(new URL('../scripts/phase10-authenticated-staging-qa.mjs',import.meta.url));
const content=readFileSync(path,'utf8');

test('staging Auth QA script compiles without credentials or network calls',()=>{
 const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8',timeout:12000});
 assert.equal(result.status,0,result.stderr||'Node syntax check failed');
});
test('real-auth QA script is staging locked, tenant aware and never mutates fleet data',()=>{
 assert.match(content,/STAGING_HOST='ofyfausfhinwgrfmapgc\.supabase\.co'/);
 assert.match(content,/protocol!=='https:'/);
 assert.match(content,/P10_ORG_A/);
 assert.match(content,/P10_ORG_B/);
 assert.match(content,/signInWithPassword/);
 assert.match(content,/auth\.getUser\(\)/);
 assert.match(content,/at_dispatch_vehicle_safety_status/);
 assert.match(content,/P10_OTHER_DRIVER_DVIR_ID/);
 assert.match(content,/P10_OOS_VEHICLE_ID/);
 assert.doesNotMatch(content,/\.(insert|update|delete|upsert)\s*\(/);
 assert.doesNotMatch(content,/service_role|secretKey|auth\.admin/);
});
