/** Original procedural 3D silhouettes. These are category renderings, NOT licensed OEM CAD. */
export const VEHICLE_FORMS=Object.freeze([
  {id:'tractor',label:'Semi tractor',subtitle:'Class 8 tractor · sleeper cab',cargo:'Commercial heavy haul'},
  {id:'box_truck',label:'Box truck',subtitle:'Straight truck · enclosed cargo',cargo:'Regional freight'},
  {id:'cargo_van',label:'Cargo van',subtitle:'High-roof delivery van',cargo:'Last-mile'},
  {id:'hotshot',label:'Hotshot rig',subtitle:'Pickup + equipment trailer',cargo:'Hotshot / open deck'},
  {id:'pickup',label:'Pickup truck',subtitle:'Light-duty transport',cargo:'Personal / courier'},
]);
export const VEHICLE_COLORS=Object.freeze([
  {id:'arctic',name:'Arctic White',hex:'#dee9e8'},
  {id:'emerald',name:'Emerald Green',hex:'#2dbd85'},
  {id:'orange',name:'AnderPointe Orange',hex:'#f78a32'},
  {id:'graphite',name:'Graphite',hex:'#48535e'},
  {id:'blue',name:'Ocean Blue',hex:'#2c77ba'},
]);
export function vehicleForm(type) {
  const t=String(type||'').toLowerCase().replace(/[\s-]/g,'_');
  if(['tractor','semi','semi_truck','class_8','freight','sleeper','tractor_trailer'].includes(t))return 'tractor';
  if(['cargo_van','van','delivery_van','sprinter','cargo'].includes(t))return 'cargo_van';
  if(['hotshot','flatbed','gooseneck','hot_shot'].includes(t))return 'hotshot';
  if(['pickup','pickup_truck','personal','personal_vehicle'].includes(t))return 'pickup';
  if(['box_truck','straight_truck','boxtruck','medium_duty'].includes(t))return 'box_truck';
  return 'box_truck';
}
export function vehicleDisplay(vehicle) {
  if(!vehicle)return {title:'Select a fleet vehicle',unit:'No assigned equipment',verified:false,form:'box_truck',hasMakeModel:false};
  const make=String(vehicle.make||'').trim();
  const model=String(vehicle.model||'').trim();
  const year=Number(vehicle.model_year);
  const validYear=Number.isInteger(year)&&year>=1980&&year<=2100;
  const name=[validYear?year:null,make||null,model||null].filter(Boolean).join(' ');
  return {
    title:name || VEHICLE_FORMS.find(x=>x.id===vehicleForm(vehicle.vehicle_type))?.label || 'Vehicle',
    unit:vehicle.unit_number||'Unnumbered equipment',
    verified:Boolean(make&&model),
    hasMakeModel:Boolean(make&&model),form:vehicleForm(vehicle.vehicle_type),
    note:make&&model?'Make and model from vehicle inventory':'Manufacturer/model not recorded — generic 3D silhouette',
  };
}
export function assignedVehicleForDriver({assignments=[],vehicles=[],driverUserId='',isDemo=false}={}) {
  if(!driverUserId)return null;
  const active=assignments.find(a=>a.driver_user_id===driverUserId
    && ['offered','assigned','accepted','at_pickup','picked_up','in_transit'].includes(a.status) && a.vehicle_id);
  const assigned=active&&vehicles.find(v=>v.id===active.vehicle_id);
  return assigned||null;
}
export function dispatcherDriverProfiles({drivers=[],vehicles=[],assignments=[]}={}) {
  return drivers.map(driver=>{
    const vehicle=assignedVehicleForDriver({assignments,vehicles,driverUserId:driver.user_id});
    const related=assignments.filter(a=>a.driver_user_id===driver.user_id);
    return {driver,vehicle,activeLoads:related.filter(a=>
      ['assigned','accepted','at_pickup','picked_up','in_transit'].includes(a.status)).length};
  });
}
export function viewModelLabel(vehicle,selectedForm) {
  const description=vehicleDisplay(vehicle);
  return {actual:description.title,preset:VEHICLE_FORMS.find(x=>x.id===selectedForm)?.label||'Generic vehicle',
    isExact:false};
}
