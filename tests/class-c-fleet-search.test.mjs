import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterClassCFleet} from '../src/lib/class-c-operations.js';
const vehicles=[
 {id:'one',unit_number:'TRK-104',make:'Toyota',model:'Prado',demoDriver:'John Miller',demoRoute:'Fort Worth Loop',condition:'Active'},
 {id:'two',unit_number:'VAN-021',make:'Toyota',model:'Hiace',demoDriver:'Oliver Smith',demoRoute:'Arlington',condition:'Critical'},
];
test('sample-wide search matches units, driver, route and model',()=>{
 for(const value of ['TRK-104','prado','John Miller','Fort Worth','active'])
  assert.equal(filterClassCFleet(vehicles,value,{isDemo:true})[0]?.id,'one');
 assert.equal(filterClassCFleet(vehicles,'OLIVER',{isDemo:true})[0]?.id,'two');
 assert.equal(filterClassCFleet(vehicles,'unknown',{isDemo:true}).length,0);
});
test('live search only sees authorized rows and never probes demo identities',()=>{
 const drivers=[{user_id:'driverA',display_name:'Recorded Driver'}];
 const assignments=[{vehicle_id:'one',driver_user_id:'driverA',reference:'AT-200',pickup_address:'Lubbock, TX'}];
 assert.equal(filterClassCFleet(vehicles,'Recorded Driver',{drivers,assignments,isDemo:false}).length,1);
 assert.equal(filterClassCFleet(vehicles,'AT-200',{drivers,assignments,isDemo:false}).length,1);
 assert.equal(filterClassCFleet(vehicles,'John Miller',{drivers,assignments,isDemo:false}).length,0);
 assert.equal(filterClassCFleet(vehicles,'Oliver Smith',{drivers,assignments,isDemo:false}).length,0);
 assert.equal(filterClassCFleet(vehicles,'prado',{drivers,assignments,isDemo:false}).length,1);
});
