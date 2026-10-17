// Driver Cockpit v1 — demo-only models and pure time calculations.
// Never use these values as certified ELD, driver pay, IFTA or health records.
export const DUTY_STATES = Object.freeze([
  {id:'OFF',label:'Off duty',color:'#6f8193'},
  {id:'SB',label:'Sleeper berth',color:'#819bff'},
  {id:'D',label:'Driving',color:'#ff9c43'},
  {id:'ON',label:'On duty',color:'#36c9b7'},
]);
export const DEMO_PEOPLE = Object.freeze([
  {id:'sample-cdl-jameson',name:'Jameson Doe',role:'CDL',subtitle:'Class A · Cold-chain freight',
    unit:'TX-604',division:'CDL',status:'D',hos:{
      driveUsedMinutes:286, windowUsedMinutes:512, intervalDriveMinutes:230, cycleUsedMinutes:2840,
    },
    log:[{start:0,end:385,status:'OFF'},{start:385,end:420,status:'ON'},
      {start:420,end:600,status:'D'},{start:600,end:635,status:'ON'},
      {start:635,end:825,status:'D'},{start:825,end:1440,status:'OFF'}],
    earnings:{base:182.40,stops:48,detention:37.50,tips:0,bonus:22.50},
    weeklyEarnings:1864.75,
    mileage:{today:263,planned:315,loaded:213,deadhead:50,odometer:184275,states:[['TX',196],['NM',67]]},
    vitals:{heartRate:77,spo2:98,alertness:88,safety:94},
    customer:'South Plains Distribution',stop:'Cold-chain inbound',address:'Midland, TX',
    instructions:'SAMPLE ONLY · Check receiving temperature and obtain signed acceptance.',
    reference:'DEMO-HOS-01'},
  {id:'sample-local-oliver',name:'Oliver Smith',role:'Local',subtitle:'Local metro EV delivery',
    unit:'EV-118',division:'Class C',status:'ON',hos:null,
    log:[{start:0,end:450,status:'OFF'},{start:450,end:490,status:'ON'},
      {start:490,end:660,status:'D'},{start:660,end:710,status:'ON'},
      {start:710,end:790,status:'D'},{start:790,end:1440,status:'OFF'}],
    earnings:{base:112,stops:56,detention:0,tips:46.80,bonus:12},
    weeklyEarnings:798.20,
    mileage:{today:84,planned:116,loaded:62,deadhead:22,odometer:28114,states:[['TX',84]]},
    vitals:{heartRate:73,spo2:99,alertness:91,safety:97},
    customer:'Metro Parcel Services',stop:'Commercial drop 6/12',address:'Burleson, TX',
    instructions:'SAMPLE ONLY · Use customer receiving dock and scan all parcels.',
    reference:'DEMO-LOCAL-02'},
  {id:'sample-cdl-michael',name:'Michael R.',role:'CDL',subtitle:'Class A · Intermodal freight',
    unit:'IM-220',division:'CDL',status:'SB',hos:{
      driveUsedMinutes:410,windowUsedMinutes:680,intervalDriveMinutes:335,cycleUsedMinutes:3480,
    },
    log:[{start:0,end:325,status:'SB'},{start:325,end:385,status:'ON'},
      {start:385,end:630,status:'D'},{start:630,end:675,status:'ON'},
      {start:675,end:840,status:'D'},{start:840,end:1440,status:'SB'}],
    earnings:{base:225.80,stops:33,detention:65,tips:0,bonus:34.75},
    weeklyEarnings:2264.10,
    mileage:{today:355,planned:482,loaded:300,deadhead:55,odometer:298111,states:[['TX',277],['OK',78]]},
    vitals:{heartRate:79,spo2:97,alertness:84,safety:92},
    customer:'Intermodal Transport Hub',stop:'Container interchange',address:'Fort Worth, TX',
    instructions:'SAMPLE ONLY · Confirm container and seal numbers at gate.',
    reference:'DEMO-INTERMODAL-03'},
]);
export function safeDutyLog(segments=[]) {
  const allowed=new Set(DUTY_STATES.map(s=>s.id));
  const slots=Array(96).fill(null);
  for(const part of segments) {
    const start=Math.floor(Number(part?.start)/15),end=Math.ceil(Number(part?.end)/15);
    if(!allowed.has(part?.status)||!Number.isFinite(start)||!Number.isFinite(end))continue;
    for(let index=Math.max(0,start);index<Math.min(96,end);index++)slots[index]=part.status;
  }
  return slots.map(s=>s||'OFF');
}
export function setDemoDutySlot(segments,status,slot=96-1) {
  if(!DUTY_STATES.some(s=>s.id===status)||!Number.isInteger(slot)||slot<0||slot>95)return safeDutyLog(segments);
  const slots=safeDutyLog(segments);
  slots[slot]=status;
  return slots;
}
export function formatHrsMinutes(minutes) {
  if(!Number.isFinite(minutes)) return '—';
  const n=Math.max(0,Math.floor(minutes));
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
export function demoHosGauges(hos) {
  if(!hos)return [];
  return [
    {label:'11-hr driving reference',max:660,used:hos.driveUsedMinutes},
    {label:'14-hr duty window reference',max:840,used:hos.windowUsedMinutes},
    {label:'8-hr driving interval reference',max:480,used:hos.intervalDriveMinutes},
    {label:'70-hr cycle example',max:4200,used:hos.cycleUsedMinutes},
  ].map(item=>({...item,remaining:Math.max(0,item.max-item.used),
    pct:Math.round(Math.min(100,Math.max(0,100*item.used/item.max)))}));
}
export function moneyTotal(parts={}) {
  return ['base','stops','detention','tips','bonus'].reduce((a,key)=>{
    const n=Number(parts[key]);return a+(Number.isFinite(n)&&n>0?n:0);
  },0);
}
export function visibleDriverAssignments(assignments=[],role='',userId='') {
  if(role!=='driver'||!userId)return [];
  return (assignments||[]).filter(x=>x.driver_user_id===userId);
}
export function cockpitRouteUrl(assignment) {
  const destination=String(assignment?.dropoff_address||'').trim();
  if(!destination||destination.length>500)return null;
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(destination);
}
