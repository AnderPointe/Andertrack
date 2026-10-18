import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterClassCFleet,classCOpsRecords} from '../src/lib/class-c-operations.js';
import {NORTHVALE_REFERENCE_VEHICLES} from '../src/lib/northvale-reference-demo.js';
import {filterClassCMapPositions} from '../src/lib/class-c-maps.js';

test('Northvale sample search filters vehicle unit, model, driver and route without creating records',()=>{
 const all=NORTHVALE_REFERENCE_VEHICLES;
 assert.equal(all.length,6);
 assert.deepEqual(filterClassCFleet(all,'prado',{isDemo:true}).map(v=>v.unit_number),['TRK-104']);
 assert.deepEqual(filterClassCFleet(all,'VAN-021',{isDemo:true}).map(v=>v.model),['Hiace']);
 assert.deepEqual(filterClassCFleet(all,'Oliver Smith',{isDemo:true}).map(v=>v.unit_number),['VAN-021']);
 assert.deepEqual(filterClassCFleet(all,'Burleson',{isDemo:true}).map(v=>v.unit_number),['TRK-104','TRK-201']);
 assert.deepEqual(filterClassCFleet(all,'Critical',{isDemo:true}).map(v=>v.unit_number),
   ['VAN-021','TRK-115','BUS-150']);
 assert.equal(filterClassCFleet(all,'nomatch',{isDemo:true}).length,0);
 assert.equal(filterClassCFleet(all,'  ',{isDemo:true}).length,6);
});
test('Northvale selected vehicle provides its own sample shift display fields',()=>{
 const first=NORTHVALE_REFERENCE_VEHICLES.find(v=>v.unit_number==='TRK-104');
 const van=NORTHVALE_REFERENCE_VEHICLES.find(v=>v.unit_number==='VAN-021');
 assert.equal(first.demoDriver,'John Miller');
 assert.equal(first.demoRoute,'Burleson – Fort Worth Metro Loop');
 assert.deepEqual(first.demoStops,[14,18]);
 assert.equal(first.demoPay,218.50);
 assert.equal(van.demoDriver,'Oliver Smith');
 assert.deepEqual(van.demoStops,[22,24]);
 assert.equal(van.demoPay,246.75);
});
test('live fleet search matches only caller-supplied authorized organization scope',()=>{
 const vehicles=[
  {id:'a',unit_number:'TX-100',vehicle_type:'cargo_van',make:'Ford',model:'Transit'},
  {id:'b',unit_number:'BOX-200',vehicle_type:'box_truck',make:'Isuzu',model:'NPR'},
 ];
 const assignments=[{id:'l1',vehicle_id:'a',driver_user_id:'driver-1',reference:'AT-8',
    pickup_address:'Burleson TX',dropoff_address:'Fort Worth TX'}];
 const drivers=[{user_id:'driver-1',display_name:'Maria Driver'}];
 assert.deepEqual(filterClassCFleet(vehicles,'Ford',{drivers,assignments}).map(v=>v.id),['a']);
 assert.deepEqual(filterClassCFleet(vehicles,'Maria',{drivers,assignments}).map(v=>v.id),['a']);
 assert.deepEqual(filterClassCFleet(vehicles,'Fort Worth',{drivers,assignments}).map(v=>v.id),['a']);
 assert.deepEqual(filterClassCFleet(vehicles,'Oliver Smith',{drivers,assignments}).map(v=>v.id),[]);
 assert.deepEqual(filterClassCFleet(vehicles,'BOX',{drivers,assignments}).map(v=>v.id),['b']);
});
test('driver-scoped loader and filter cannot reveal another driver or vehicle',()=>{
 const vehicles=[
  {id:'a',unit_number:'VAN-101',vehicle_type:'cargo_van',enabled:true},
  {id:'b',unit_number:'VAN-102',vehicle_type:'cargo_van',enabled:true},
 ];
 const assignments=[
   {id:'a1',vehicle_id:'a',driver_user_id:'own',status:'accepted',pickup_address:'Mansfield TX'},
   {id:'a2',vehicle_id:'b',driver_user_id:'other',status:'accepted',pickup_address:'Dallas TX'},
 ];
 const drivers=[{user_id:'own',display_name:'Own Driver'},{user_id:'other',display_name:'Another Driver'}];
 const scope=classCOpsRecords({vehicles,assignments,drivers,role:'driver',currentUserId:'own'});
 assert.deepEqual(scope.vehicles.map(v=>v.id),['a']);
 assert.deepEqual(filterClassCFleet(scope.vehicles,'Dallas',{
   drivers:scope.drivers,assignments:scope.assignments,
 }),[]);
 assert.deepEqual(filterClassCFleet(scope.vehicles,'Mansfield',{
   drivers:scope.drivers,assignments:scope.assignments,
 }).map(v=>v.id),['a']);
});

test('global Class C search filters only GPS pins for authorized matching vehicles',()=>{
 const vehicles=[
  {id:'a',unit_number:'TX-100',vehicle_type:'cargo_van',make:'Ford',model:'Transit'},
  {id:'b',unit_number:'TX-200',vehicle_type:'cargo_van',make:'Mercedes',model:'Sprinter'},
 ];
 const assignedLocations=[
  {vehicle:{id:'a'},id:'gps-a',unit:'TX-100'},
  {vehicle:{id:'b'},id:'gps-b',unit:'TX-200'},
 ];
 const searchResult=filterClassCFleet(vehicles,'Ford');
 assert.deepEqual(searchResult.map(v=>v.id),['a']);
 assert.deepEqual(filterClassCMapPositions(assignedLocations,searchResult.map(v=>v.id))
   .map(point=>point.id),['gps-a']);
 // No global query preserves existing GPS behavior; an empty search result removes all pins.
 assert.equal(filterClassCMapPositions(assignedLocations,null).length,2);
 assert.deepEqual(filterClassCMapPositions(assignedLocations,[]),[]);
 assert.deepEqual(filterClassCMapPositions(assignedLocations,['unauthorized']),[]);
 assert.deepEqual(filterClassCMapPositions(assignedLocations,['a','outside']),
   [assignedLocations[0]]);
});

test('unmatched demo search is an explicit empty selection, never another driver',()=>{
 const visible=filterClassCFleet(NORTHVALE_REFERENCE_VEHICLES,'not-a-real-unit',{isDemo:true});
 assert.deepEqual(visible,[]);
 const focused=visible[0]||null;
 assert.equal(focused,null);
 // The dashboard must pass null (not an empty unit string) to its sample shift ribbon.
 assert.equal(focused?.unit_number??null,null);
});
