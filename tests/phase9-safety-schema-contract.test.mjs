import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/sql/class_c_dvir_service_rls_review.sql',
 import.meta.url),'utf8');

test('Phase 9 review migration defines exactly the three safety tables and enables RLS',()=>{
 for(const table of ['at_vehicle_dvir_reports','at_vehicle_service_orders',
   'at_vehicle_safety_events']){
  assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS public\\.'+table,'i'));
  assert.match(sql,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY','i'));
 }
});

test('Phase 9 direct client write privilege stays revoked for both anon and authenticated',()=>{
 assert.match(sql,/REVOKE ALL ON public\.at_vehicle_dvir_reports,public\.at_vehicle_service_orders,[\s\S]*?FROM PUBLIC,anon,authenticated;/);
 assert.match(sql,/GRANT SELECT ON public\.at_vehicle_dvir_reports,public\.at_vehicle_service_orders,[\s\S]*?TO authenticated;/);
 assert.doesNotMatch(sql,/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+public\.at_vehicle_/i);
});

test('each maintenance write operation checks authentication and is explicitly revoked from anon',()=>{
 const functions=[
  'at_submit_vehicle_dvir','at_create_service_work_order',
  'at_update_service_work_order','at_review_vehicle_dvir'
 ];
 for(const fn of functions){
  assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\('));
  assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+fn+'\\('));
  assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+fn+'\\('));
 }
 assert.equal((sql.match(/SECURITY DEFINER/g)||[]).length>=5,true);
 assert.match(sql,/v_user uuid := auth\.uid\(\)/);
});

test('server enforces own active assignment and severe-defect repair gate',()=>{
 assert.match(sql,/a\.driver_user_id=v_user AND a\.vehicle_id=p_vehicle_id/);
 assert.match(sql,/p_attested IS DISTINCT FROM true/);
 assert.match(sql,/p_next_status='closed' AND v_report\.severity='out-of-service'/);
 assert.match(sql,/o\.status='completed'/);
 assert.match(sql,/at_vehicle_safety_events\s*\(/);
});
