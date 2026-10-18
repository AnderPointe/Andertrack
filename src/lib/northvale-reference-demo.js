/**
 * Adapted from the user-supplied NorthvaleClassCDashboard prototype.
 * Entirely fictional sample data. NEVER inject these records into authenticated
 * production vehicle/driver/maintenance systems.
 */
export const NORTHVALE_REFERENCE_VEHICLES=Object.freeze([
  {id:'nv-prado',unit_number:'TRK-104',make:'Toyota',model:'Prado',model_year:2025,
    vehicle_type:'personal_vehicle',gvwr_lbs:6600,enabled:true,condition:'Active',score:92,
    demoDriver:'John Miller',demoRoute:'Burleson – Fort Worth Metro Loop',
    demoPay:218.50,demoStops:[14,18],demoMiles:84.2,
    hotspots:[
      {id:'fl-tire',x:24,y:31,label:'Front left brake pad wear (78%)',severity:'warning'},
      {id:'rl-tire',x:24,y:71,label:'Rear left tire pressure (29 PSI)',severity:'critical'},
      {id:'engine',x:50,y:20,label:'Engine temperature: sample normal (96%)',severity:'healthy'},
      {id:'trans',x:50,y:48,label:'Transmission fluid sample: due in 12 days',severity:'warning'},
    ],
    subsystems:{Engine:[96,'%'],Fuel:[8.6,'km/L'],Brakes:[82,'%'],Efficiency:[88,'%'],Battery:[91,'%'],Transmission:[58,'%']}},
  {id:'nv-hilux',unit_number:'TRK-107',make:'Toyota',model:'Hilux',model_year:2024,
    vehicle_type:'pickup',gvwr_lbs:7050,enabled:true,condition:'Service',score:64,
    demoDriver:'Carlos Reyes',demoRoute:'South Dallas Express',demoPay:194,
    demoStops:[11,15],demoMiles:96.4,
    hotspots:[
      {id:'fl-tire',x:24,y:31,label:'Front left rotor: sample service needed',severity:'warning'},
      {id:'engine',x:50,y:20,label:'Oil change sample: scheduled tomorrow',severity:'warning'},
    ],
    subsystems:{Engine:[81,'%'],Fuel:[9.2,'km/L'],Brakes:[62,'%'],Efficiency:[79,'%'],Battery:[74,'%'],Transmission:[68,'%']}},
  {id:'nv-hiace',unit_number:'VAN-021',make:'Toyota',model:'Hiace',model_year:2024,
    vehicle_type:'cargo_van',gvwr_lbs:9350,enabled:true,condition:'Critical',score:38,
    demoDriver:'Oliver Smith',demoRoute:'Arlington Commercial District',demoPay:246.75,
    demoStops:[22,24],demoMiles:112.8,
    hotspots:[
      {id:'fl-tire',x:24,y:31,label:'Front left tire pressure (24 PSI)',severity:'critical'},
      {id:'rl-tire',x:24,y:71,label:'Rear brake caliper: sample alert',severity:'critical'},
    ],
    subsystems:{Engine:[54,'%'],Fuel:[7.4,'km/L'],Brakes:[41,'%'],Efficiency:[62,'%'],Battery:[49,'%'],Transmission:[60,'%']}},
  {id:'nv-hilux-115',unit_number:'TRK-115',make:'Toyota',model:'Hilux',model_year:2023,
    vehicle_type:'hotshot',gvwr_lbs:8500,enabled:true,condition:'Critical',score:45,
    demoDriver:'Marcus Vance',demoRoute:'Mansfield Industrial Park',demoPay:182.20,
    demoStops:[9,12],demoMiles:68,
    hotspots:[],
    subsystems:{Engine:[72,'%'],Fuel:[8.1,'km/L'],Brakes:[48,'%'],Efficiency:[70,'%'],Battery:[39,'%'],Transmission:[75,'%']}},
  {id:'nv-coaster',unit_number:'BUS-150',make:'Toyota',model:'Coaster',model_year:2022,
    vehicle_type:'box_truck',gvwr_lbs:14200,enabled:true,condition:'Critical',score:52,
    demoDriver:'Elena Rostova',demoRoute:'DFW Airport Regional Shuttle',demoPay:260,
    demoStops:[8,10],demoMiles:134.5,
    hotspots:[],
    subsystems:{Engine:[69,'%'],Fuel:[6.8,'km/L'],Brakes:[71,'%'],Efficiency:[74,'%'],Battery:[55,'%'],Transmission:[80,'%']}},
  {id:'nv-land-cruiser',unit_number:'TRK-201',make:'Toyota',model:'Land Cruiser',model_year:2025,
    vehicle_type:'personal_vehicle',gvwr_lbs:7385,enabled:true,condition:'Active',score:95,
    demoDriver:'Devon Brooks',demoRoute:'Cleburne – Burleson Corridor',demoPay:230,
    demoStops:[16,16],demoMiles:104,
    hotspots:[],
    subsystems:{Engine:[98,'%'],Fuel:[8.9,'km/L'],Brakes:[94,'%'],Efficiency:[91,'%'],Battery:[96,'%'],Transmission:[92,'%']}},
]);
export const NORTHVALE_REFERENCE_ALERTS=Object.freeze([
  {id:'ALT-1',unit:'TRK-104',title:'Engine temperature high',severity:'critical',source:'Synthetic video alert · 2 min ago'},
  {id:'ALT-2',unit:'VAN-021',title:'Tire pressure low',severity:'high',source:'Synthetic video alert · 15 min ago'},
  {id:'ALT-3',unit:'TRK-107',title:'Oil change due soon',severity:'medium',source:'Synthetic video alert · 1 hour ago'},
  {id:'ALT-4',unit:'TRK-115',title:'Brake inspection complete',severity:'resolved',source:'Synthetic video alert · 3 hours ago'},
  {id:'ALT-5',unit:'TRK-201',title:'Battery health low',severity:'critical',source:'Synthetic video alert · 5 hours ago'},
]);
export const NORTHVALE_REFERENCE_SCHEDULE=Object.freeze([
  {id:'SRV-1',day:0,time:'08:00',job:'Oil Change',unit:'TRK-107',bay:'AutoCare Workshop',state:'Scheduled'},
  {id:'SRV-2',day:0,time:'09:30',job:'Tire Rotation',unit:'VAN-021',bay:'City Garage',state:'Scheduled'},
  {id:'SRV-3',day:1,time:'08:00',job:'Brake Inspection',unit:'TRK-104',bay:'FastTrack Service',state:'Scheduled'},
  {id:'SRV-4',day:1,time:'10:00',job:'Battery Test',unit:'BUS-150',bay:'ElectroFix',state:'Scheduled'},
  {id:'SRV-5',day:2,time:'09:00',job:'Tire Rotation',unit:'TRK-201',bay:'Express Tire Hub',state:'Scheduled'},
  {id:'SRV-6',day:3,time:'08:30',job:'Battery Replacement',unit:'TRK-115',bay:'AutoCare Workshop',state:'Scheduled'},
  {id:'SRV-7',day:3,time:'10:00',job:'Oil Change',unit:'TRK-104',bay:'Prime Motors',state:'Scheduled'},
  {id:'SRV-8',day:4,time:'09:30',job:'Oil Change',unit:'VAN-021',bay:'City Garage',state:'Scheduled'},
]);
export const NORTHVALE_REFERENCE_FORECAST=Object.freeze([
  {month:'Jan',actual:3600,forecast:3900},
  {month:'Feb',actual:4100,forecast:4000},
  {month:'Mar',actual:3800,forecast:4200},
  {month:'Apr',actual:4900,forecast:4600},
  {month:'May',actual:4300,forecast:4800},
  {month:'Jun',actual:4592,forecast:5100},
  {month:'Jul',actual:5200,forecast:5300},
  {month:'Aug',actual:6100,forecast:5800},
  {month:'Sep',actual:5400,forecast:5600},
  {month:'Oct',actual:5900,forecast:6000},
  {month:'Nov',actual:6800,forecast:6500},
  {month:'Dec',actual:6400,forecast:6700},
]);
export function northvaleDemoVehicle(unit) {
  return NORTHVALE_REFERENCE_VEHICLES.find(v=>v.unit_number===unit)||null;
}
export function northvaleHotspots(unit) {
  return northvaleDemoVehicle(unit)?.hotspots||[];
}
export function northvaleMonth(index=5) {
  return NORTHVALE_REFERENCE_FORECAST[index]||NORTHVALE_REFERENCE_FORECAST[5];
}
