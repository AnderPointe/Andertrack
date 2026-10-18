import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/sql/phase10_active_vehicle_exclusivity_review.sql',import.meta.url),'utf8');

test('active vehicle exclusivity is serialized and covers real mutation boundaries',()=>{
 assert.match(sql,/REVIEW ONLY/);
 assert.match(sql,/to_regprocedure\('at_internal\.reject_unsafe_dispatch\(\)'\)/);
 assert.match(sql,/CREATE TRIGGER at_phase10_active_vehicle_exclusivity/);
 assert.match(sql,/AFTER INSERT OR UPDATE OF status,vehicle_id,driver_user_id/);
 assert.match(sql,/WHERE v\.id=NEW\.vehicle_id AND v\.organization_id=NEW\.organization_id\s+FOR UPDATE/);
 assert.match(sql,/a\.id<>NEW\.id/);
 assert.match(sql,/a\.status IN\s+\('offered','assigned','accepted','at_pickup','picked_up','in_transit'\)/);
 assert.match(sql,/Vehicle has another active assignment; dispatch denied/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION at_internal\.reject_duplicate_active_vehicle\(\)/);
 assert.doesNotMatch(sql,/GRANT EXECUTE .* TO authenticated/);
});
