import React from 'react';
import OpsCommandCenter from './features/live/OpsCommandCenter.jsx';

const now = Date.now();
const daysAgo = days => new Date(now - days * 86400000).toISOString();
const demoAssignments = [
  {id:'s1',reference:'AT-2048',division:'CDL',customer_name:'West Texas Industrial',commodity:'Industrial freight · palletized',pickup_address:'Midland, TX',dropoff_address:'Odessa, TX',estimated_miles:24,status:'in_transit',driver_user_id:'d1',vehicle_id:'v1',created_at:daysAgo(0)},
  {id:'s2',reference:'AT-2049',division:'Class C',customer_name:'Metro Retail',commodity:'Retail delivery · six packages',pickup_address:'Fort Worth, TX',dropoff_address:'Burleson, TX',estimated_miles:19,status:'accepted',driver_user_id:'d2',vehicle_id:'v2',created_at:daysAgo(0)},
  {id:'s3',reference:'AT-2050',division:'Class C',customer_name:'Business Courier',commodity:'Office equipment',pickup_address:'Dallas, TX',dropoff_address:'Irving, TX',estimated_miles:14,status:'unassigned',driver_user_id:null,created_at:daysAgo(1)},
  {id:'s4',reference:'AT-2051',division:'CDL',customer_name:'Regional Distribution',commodity:'Temperature-controlled freight',pickup_address:'Abilene, TX',dropoff_address:'Fort Worth, TX',estimated_miles:150,status:'offered',driver_user_id:'d3',vehicle_id:'v3',created_at:daysAgo(1)},
  {id:'s5',reference:'AT-2052',division:'CDL',customer_name:'Supply & Logistics',commodity:'Pallet freight',pickup_address:'Houston, TX',dropoff_address:'Austin, TX',estimated_miles:164,status:'delivered',driver_user_id:'d1',created_at:daysAgo(2)},
  {id:'s6',reference:'AT-2053',division:'Class C',customer_name:'Northstar Express',commodity:'Parcel consignment',pickup_address:'Plano, TX',dropoff_address:'Denton, TX',estimated_miles:38,status:'in_transit',driver_user_id:'d2',created_at:daysAgo(3)},
  {id:'s7',reference:'AT-2054',division:'CDL',customer_name:'Western Materials',commodity:'Equipment delivery',pickup_address:'Lubbock, TX',dropoff_address:'Midland, TX',estimated_miles:119,status:'delivered',driver_user_id:'d3',created_at:daysAgo(5)},
];
const demoDrivers = [
  {id:'p1',user_id:'d1',display_name:'Marcus Taylor',license_class:'A',license_verified:true,availability:'available'},
  {id:'p2',user_id:'d2',display_name:'Alex Rivera',license_class:'C',license_verified:true,availability:'available'},
  {id:'p3',user_id:'d3',display_name:'Jordan Lee',license_class:'B',license_verified:true,availability:'busy'},
  {id:'p4',user_id:'d4',display_name:'Sam Carter',license_class:'A',license_verified:true,availability:'offline'},
  {id:'p5',user_id:'d5',display_name:'Morgan Brooks',license_class:'C',license_verified:true,availability:'available'},
];
const demoVehicles=[
  {id:'v1',unit_number:'TX-2048',make:'Volvo',model:'VNL 760',model_year:2025,vehicle_type:'tractor',required_license_class:'A',enabled:true},
  {id:'v2',unit_number:'VAN-071',make:'Ford',model:'Transit 350',model_year:2024,vehicle_type:'cargo_van',required_license_class:'C',enabled:true},
  {id:'v3',unit_number:'BOX-116',make:'Freightliner',model:'M2 106',model_year:2023,vehicle_type:'box_truck',required_license_class:'B',enabled:true},
  {id:'v4',unit_number:'HOT-042',make:'Ram',model:'3500',model_year:2025,vehicle_type:'hotshot',required_license_class:'A',enabled:false},
  {id:'v5',unit_number:'VAN-095',make:'Mercedes-Benz',model:'Sprinter 2500',model_year:2024,vehicle_type:'cargo_van',required_license_class:'C',payload_capacity_lbs:2300,enabled:true},
];
const demoLocations=[
  {id:'loc1',driver_id:'d1',vehicle_id:'v1',latitude:32.748,longitude:-97.337,status:'in_transit',unit_number:'TX-2048',last_ping_at:new Date(now-90000).toISOString()},
  {id:'loc2',driver_id:'d2',vehicle_id:'v2',latitude:32.555,longitude:-97.321,status:'available',unit_number:'VAN-071',last_ping_at:new Date(now-180000).toISOString()},
  {id:'loc3',driver_id:'d3',vehicle_id:'v3',latitude:31.997,longitude:-102.079,status:'loaded',unit_number:'BOX-116',last_ping_at:new Date(now-650000).toISOString()},
  {id:'loc4',driver_id:'d4',vehicle_id:'v4',latitude:32.475,longitude:-99.733,status:'off_duty',unit_number:'HOT-042',last_ping_at:new Date(now-2400000).toISOString()},
  {id:'loc5',driver_id:'d5',vehicle_id:'v5',latitude:32.781,longitude:-96.798,status:'available',unit_number:'VAN-095',last_ping_at:new Date(now-45000).toISOString()},
];
export default function App({onReturn=()=>{}}) {
  return <OpsCommandCenter isDemo
    session={{user:{id:'demo-only',email:'demo@andetrack.com'}}}
    organizationId="demo-only" role="admin" memberships={[{organization_id:'demo-only',role:'admin'}]}
    setOrganizationId={()=>{}} assignments={demoAssignments} drivers={demoDrivers}
    vehicles={demoVehicles} locations={demoLocations}
    dispatchRequests={[{id:'rq1',driver_user_id:'d5',status:'queued',queue_number:1,requested_at:new Date(now-720000).toISOString()},{id:'rq2',driver_user_id:'d1',status:'queued',queue_number:2,requested_at:new Date(now-480000).toISOString()},{id:'rq3',driver_user_id:'d2',status:'queued',queue_number:3,requested_at:new Date(now-240000).toISOString()}]}
    profile={null} sync="Demo — no database connection" loading={false}
    onDemo={onReturn} onSignOut={onReturn} reload={()=>{}}/>;
}
