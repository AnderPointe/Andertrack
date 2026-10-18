import {ACTIVE_STATUSES} from './operations.js';

const CLASS_C_FORMS=new Set(['cargo_van','van','sprinter','box_truck','straight_truck',
  'pickup','pickup_truck','personal_vehicle','utility','utility_vehicle','hotshot']);
export const NORTHVALE_TABS=Object.freeze([
  {id:'dashboard',label:'Dashboard'},
  {id:'vehicles',label:'Vehicles'},
  {id:'service',label:'Service Plan'},
  {id:'analytics',label:'Analytics'},
]);
export const NORTHVALE_DEMO=Object.freeze({
  summary:{total:128,active:115,maintenance:15,criticalAlerts:28},
  health:{active:92,service:64,critical:38,score:86,criticalUnits:5,needsAttention:18,healthy:105},
  service:{today:24,week:18,inService:12,completed:16,overdue:6},
  monthCosts:{actual:4592,forecast:5100,month:'Jun 2026'},
  budgets:{used:54000,budget:60000},
  operatingCosts:{Fuel:1850,Maintenance:1480,Insurance:620,Other:642},
  subsystems:[
    {label:'Engine',score:96,unit:'%',tone:'good'},
    {label:'Fuel economy',score:8.6,unit:'km/L',tone:'neutral'},
    {label:'Brakes',score:82,unit:'%',tone:'watch'},
    {label:'Efficiency',score:88,unit:'%',tone:'good'},
    {label:'Battery',score:91,unit:'%',tone:'good'},
    {label:'Transmission',score:58,unit:'%',tone:'alert'},
  ],
});
export const NORTHVALE_DEMO_VEHICLES=Object.freeze([
  {id:'nv-prado',unit_number:'TRK-104',make:'Toyota',model:'Prado',model_year:2025,
    vehicle_type:'personal_vehicle',enabled:true,gvwr_lbs:null,condition:'Healthy',score:91},
  {id:'nv-hiace',unit_number:'VAN-021',make:'Toyota',model:'Hiace',model_year:2024,
    vehicle_type:'cargo_van',enabled:true,gvwr_lbs:null,condition:'Service due',score:74},
  {id:'nv-hilux',unit_number:'TRK-107',make:'Toyota',model:'Hilux',model_year:2024,
    vehicle_type:'pickup',enabled:true,gvwr_lbs:null,condition:'Healthy',score:95},
]);
export const NORTHVALE_DEMO_SCHEDULE=Object.freeze([
  {id:'svc-1',unit:'VAN-021',job:'Oil and filter change',day:0,time:'08:00',bay:'Bay 02',state:'Scheduled'},
  {id:'svc-2',unit:'TRK-104',job:'Brake inspection',day:1,time:'10:30',bay:'Bay 01',state:'In progress'},
  {id:'svc-3',unit:'TRK-107',job:'Tire rotation',day:2,time:'09:00',bay:'Bay 03',state:'Scheduled'},
  {id:'svc-4',unit:'VAN-021',job:'Electrical check',day:3,time:'13:00',bay:'Bay 02',state:'Scheduled'},
  {id:'svc-5',unit:'TRK-104',job:'Fluid service',day:4,time:'11:00',bay:'Bay 01',state:'Completed'},
]);
export const NORTHVALE_DEMO_ALERTS=Object.freeze([
  {id:'alert-1',unit:'TRK-104',title:'Front brake wear',severity:'critical',source:'Synthetic brake telemetry'},
  {id:'alert-2',unit:'VAN-021',title:'Tire pressure below threshold',severity:'high',source:'Synthetic TPMS reading'},
  {id:'alert-3',unit:'TRK-107',title:'Scheduled inspection due',severity:'medium',source:'Synthetic maintenance record'},
]);
export const NORTHVALE_DEMO_WEEK=Object.freeze(['Mon 08','Tue 09','Wed 10','Thu 11','Fri 12']);
export const NORTHVALE_DEMO_COSTS=Object.freeze([
 {month:'Jan',actual:3400,forecast:3750},{month:'Feb',actual:3600,forecast:3900},
 {month:'Mar',actual:4080,forecast:4200},{month:'Apr',actual:3890,forecast:4460},
 {month:'May',actual:4280,forecast:4670},{month:'Jun',actual:4592,forecast:5100},
]);
export function classCEligibility(vehicle) {
  if(!vehicle)return {category:false,eligible:false,verified:false,label:'No assigned vehicle'};
  const type=String(vehicle.vehicle_type||'').toLowerCase().replace(/[\s-]/g,'_');
  const category=CLASS_C_FORMS.has(type);
  const gvwr=vehicle.gvwr_lbs==null?null:Number(vehicle.gvwr_lbs);
  const verified=Number.isFinite(gvwr)&&gvwr>0;
  const eligible=category&&(!verified||gvwr<26000);
  return {category,eligible,verified,label:!category?'Outside local Class C catalog':
    !verified?'GVWR not verified — confirm under 26,000 lbs':gvwr>=26000?
    'Exceeds 26,000-lb Class C planning threshold':'Vehicle GVWR recorded under 26,000 lbs'};
}
export function classCOpsRecords({vehicles=[],assignments=[],drivers=[],role='',currentUserId='',isDemo=false}={}) {
  const scopedDrivers=role==='driver'&&!isDemo?drivers.filter(d=>d.user_id===currentUserId):drivers;
  const visibleAssignments=role==='driver'&&!isDemo?
    assignments.filter(a=>a.driver_user_id===currentUserId):assignments;
  const ids=new Set(visibleAssignments.map(a=>a.vehicle_id).filter(Boolean));
  const candidate=role==='driver'&&!isDemo?vehicles.filter(v=>ids.has(v.id)):vehicles;
  const filteredVehicles=candidate.filter(v=>classCEligibility(v).eligible);
  const vehicleIds=new Set(filteredVehicles.map(v=>v.id));
  const matchedAssignments=visibleAssignments.filter(a=>a.vehicle_id&&vehicleIds.has(a.vehicle_id));
  const current=matchedAssignments.filter(a=>ACTIVE_STATUSES.has(a.status));
  return {vehicles:filteredVehicles,assignments:matchedAssignments,drivers:scopedDrivers,
    counts:{total:filteredVehicles.length,active:current.length,
      disabled:filteredVehicles.filter(v=>!v.enabled).length,
      pending:matchedAssignments.filter(a=>a.status==='unassigned').length},
    hasUnverifiedGvwr:filteredVehicles.some(v=>!classCEligibility(v).verified),
  };
}
/**
 * Search already-authorized Class C equipment by unit/model/driver/route.
 * This never fetches additional data: callers must supply RLS-scoped vehicle,
 * assignment and driver records, or the explicitly synthetic demo catalog.
 */
export function filterClassCFleet(vehicles=[],query='',{
  drivers=[],assignments=[],isDemo=false,
}={}) {
  const needle=String(query||'').trim().toLocaleLowerCase();
  if(!needle)return vehicles;
  const driverById=new Map(drivers.map(d=>[d.user_id,d.display_name||'']));
  const attrsByVehicle=new Map();
  for(const assignment of assignments) {
    if(!assignment?.vehicle_id)continue;
    const list=attrsByVehicle.get(assignment.vehicle_id)||[];
    list.push([assignment.reference,assignment.customer_name,
      assignment.pickup_address,assignment.dropoff_address,
      driverById.get(assignment.driver_user_id)].filter(Boolean).join(' '));
    attrsByVehicle.set(assignment.vehicle_id,list);
  }
  return vehicles.filter(v=>{
    const recorded=[v.unit_number,v.make,v.model,v.model_year,v.vehicle_type,
      ...(attrsByVehicle.get(v.id)||[])];
    if(isDemo)recorded.push(v.demoDriver,v.demoRoute,v.condition);
    return recorded.some(t=>String(t??'').toLocaleLowerCase().includes(needle));
  });
}

export function classCDriverAssignment({assignments=[],vehicles=[],currentUserId=''}={}) {
  const own=assignments.find(a=>a.driver_user_id===currentUserId&&
    ACTIVE_STATUSES.has(a.status)&&a.vehicle_id&&vehicles.some(v=>v.id===a.vehicle_id&&classCEligibility(v).eligible));
  return {assignment:own||null,vehicle:own?vehicles.find(v=>v.id===own.vehicle_id)||null:null};
}
export function classCShiftElapsed(startMs,nowMs=Date.now()) {
  if(!Number.isFinite(startMs)||startMs>nowMs)return 0;
  return Math.max(0,Math.floor((nowMs-startMs)/60000));
}
export function classCStops(assignments=[],driverUserId='') {
  return assignments.filter(a=>a.driver_user_id===driverUserId&&
    a.status!=='cancelled'&&a.division?.toLowerCase().includes('class c'));
}
export function classCServiceDraft(value={}) {
  const unit=String(value.unit||'').trim().slice(0,60);
  const job=String(value.job||'').trim().slice(0,140);
  const day=Number(value.day),time=String(value.time||'').trim();
  const bay=String(value.bay||'Unassigned').trim().slice(0,60);
  const valid=unit.length>0&&job.length>2&&Number.isInteger(day)&&day>=0&&day<=4
    &&/^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  return {valid,unit,job,day,time,bay,state:'Scheduled'};
}
export function classCDvirDraft({unit='',driverId='',defect='',severity='needs-review',note='',time}={}) {
  const cleanDefect=String(defect||'').trim().slice(0,120);
  const cleanNote=String(note||'').trim().slice(0,500);
  const valid=String(unit).trim().length>0&&cleanDefect.length>2
    &&['needs-review','out-of-service'].includes(severity);
  return {valid,unit:String(unit).trim().slice(0,60),
    driverId:String(driverId||'').slice(0,100),defect:cleanDefect,
    severity,note:cleanNote,createdAt:time||new Date().toISOString(),
    status:'LOCAL DRAFT — NOT SUBMITTED',source:'Andertrack sample safety workflow'};
}
export function classCCostBreakdown(values={}) {
  return Object.entries(values).filter(([,amount])=>Number(amount)>0).map(([label,amount])=>
    ({label,value:Number(amount)}));
}
