import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 VEHICLE_FORMS,VEHICLE_COLORS,VEHICLE_MODEL_PRESETS,previewPresetForVehicle,vehicleForm,vehicleDisplay,assignedVehicleForDriver,
 dispatcherDriverProfiles,viewModelLabel,
} from '../src/lib/vehicle-3d.js';
import {
 warehouseCards,warehouseCounts,shipmentDashboardCounts,shipmentActivityByDay,
} from '../src/lib/modern-operations.js';
const vehicles=[
 {id:'v1',unit_number:'TRK-055',vehicle_type:'tractor',enabled:true,
  make:'Freightliner',model:'Cascadia',model_year:2025},
 {id:'v2',unit_number:'VAN-016',vehicle_type:'cargo_van',enabled:true},
 {id:'v3',unit_number:'BOX-002',vehicle_type:'box_truck',enabled:false},
];
const drivers=[{user_id:'d1',display_name:'Driver One'},{user_id:'d2',display_name:'Driver Two'}];
const assignments=[
 {id:'a1',reference:'AT-10',driver_user_id:'d1',vehicle_id:'v1',
  status:'in_transit',pickup_address:'Odessa, TX',dropoff_address:'Midland, TX',
  created_at:'2026-10-17T10:00:00Z'},
 {id:'a2',reference:'AT-11',driver_user_id:'d2',vehicle_id:'v2',status:'delivered',
  created_at:'2026-10-16T10:00:00Z'},
 {id:'a3',reference:'AT-12',driver_user_id:null,vehicle_id:null,status:'unassigned',
  created_at:'2026-10-15T11:00:00Z'},
];
test('all five vehicle 3D classes have deterministic generic silhouettes',()=>{
 assert.equal(VEHICLE_FORMS.length,5);
 assert.ok(VEHICLE_COLORS.length>=5);
 assert.equal(vehicleForm('tractor'),'tractor');
 assert.equal(vehicleForm('cargo van'),'cargo_van');
 assert.equal(vehicleForm('gooseneck'),'hotshot');
 assert.equal(vehicleForm('pickup'),'pickup');
 assert.equal(vehicleForm('straight-truck'),'box_truck');
});
test('model is real metadata only when make and model are recorded',()=>{
 const real=vehicleDisplay(vehicles[0]);
 assert.equal(real.title,'2025 Freightliner Cascadia');
 assert.equal(real.unit,'TRK-055');
 assert.equal(real.hasMakeModel,true);
 const missing=vehicleDisplay(vehicles[1]);
 assert.equal(missing.hasMakeModel,false);
 assert.equal(missing.form,'cargo_van');
 assert.equal(vehicleDisplay(null).verified,false);
 assert.equal(viewModelLabel(vehicles[0],'tractor').isExact,false);
});
test('driver sees only linked vehicle from their own active assignment',()=>{
 assert.equal(assignedVehicleForDriver({
   driverUserId:'d1',assignments,vehicles,
 }).id,'v1');
 assert.equal(assignedVehicleForDriver({
   driverUserId:'d2',assignments,vehicles,
 }),null);
 assert.equal(assignedVehicleForDriver({
   driverUserId:'not-a-driver',assignments,vehicles,
 }),null);
 const profiles=dispatcherDriverProfiles({drivers,vehicles,assignments});
 assert.equal(profiles.length,2);
 assert.equal(profiles[0].vehicle.id,'v1');
 assert.equal(profiles[1].vehicle,null);
});
test('warehouse counts derive actual equipment and loads not fictional docks or weights',()=>{
 const rows=warehouseCards({vehicles,assignments,drivers,isDemo:false});
 assert.equal(rows[0].state,'Assigned');
 assert.equal(rows[0].driver.display_name,'Driver One');
 assert.equal(rows[1].state,'Ready');
 assert.equal(rows[2].state,'Unavailable');
 assert.ok(rows.every(r=>r.sampleProgress===null));
 assert.deepEqual(warehouseCounts(rows,assignments),{
  registered:3,assigned:1,ready:1,disabled:1,unassignedShipments:1,
 });
 assert.equal(warehouseCards({vehicles,assignments,drivers,isDemo:true})[0].sampleProgress,48);
});
test('delivery KPI and date histogram use only recorded shipment data',()=>{
 assert.deepEqual(shipmentDashboardCounts(assignments),{
  total:3,delivered:1,active:1,unassigned:1,completionRate:33,
 });
 const series=shipmentActivityByDay(assignments,Date.parse('2026-10-17T18:00:00Z'),3);
 assert.equal(series.length,3);
 assert.deepEqual(series.map(x=>x.count),[1,1,1]);
 assert.equal(shipmentDashboardCounts([]).completionRate,0);
});

test('manufacturer/model preview controls are independent from actual assignment inventory',()=>{
 assert.equal(VEHICLE_MODEL_PRESETS.length,11);
 assert.equal(previewPresetForVehicle(vehicles[0]),'freightliner-cascadia');
 assert.equal(previewPresetForVehicle({make:'Volvo',model:'VNL 760'}),'volvo-vnl');
 assert.equal(previewPresetForVehicle({make:'Generic',model:'Unrecorded'}),'');
 assert.equal(VEHICLE_MODEL_PRESETS.find(p=>p.id==='ford-transit').form,'cargo_van');
});
