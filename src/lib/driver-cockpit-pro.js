// Driver Cockpit Pro simulation utilities. No compliance, pay, medical or tax authority.
export const DEMO_CHECKLIST = Object.freeze([
  {id:'customer',label:'Confirm recipient and delivery location'},
  {id:'parcels',label:'Review package count and cargo condition'},
  {id:'proof',label:'Confirm that sample photo/signature evidence is staged'},
  {id:'handoff',label:'Finish customer handoff and secure equipment'},
]);

export function dutySlotToTime(slot) {
  if(!Number.isInteger(slot) || slot<0 || slot>95)return '—';
  const minute=slot*15;
  return String(Math.floor(minute/60)).padStart(2,'0')+':'+
    String(minute%60).padStart(2,'0');
}

export function summarizeDutySlots(slots=[]) {
  const result={OFF:0,SB:0,D:0,ON:0,totalMinutes:0,transitions:0};
  let previous=null;
  for(const slot of slots) {
    if(!Object.prototype.hasOwnProperty.call(result,slot))continue;
    result[slot]+=15;
    result.totalMinutes+=15;
    if(previous!=null && previous!==slot)result.transitions++;
    previous=slot;
  }
  return result;
}

export function dutySegmentsFromSlots(slots=[]) {
  const segments=[];
  let start=0;
  for(let i=0;i<=slots.length;i++) {
    if(i>0&&(i===slots.length||slots[i]!==slots[start])) {
      segments.push({status:slots[start],startSlot:start,endSlot:i,
        start:dutySlotToTime(start),end:i===96?'24:00':dutySlotToTime(i),
        durationMinutes:(i-start)*15});
      start=i;
    }
  }
  return segments.filter(s=>['OFF','SB','D','ON'].includes(s.status));
}

export function paintDutyRange(slots=[],startSlot=0,length=1,status='ON') {
  if(!Array.isArray(slots) || slots.length!==96 ||
    !['OFF','SB','D','ON'].includes(status) ||
    !Number.isInteger(startSlot)||startSlot<0||startSlot>95||
    !Number.isInteger(length)||length<1)return [...slots];
  const copy=[...slots];
  for(let i=startSlot;i<Math.min(96,startSlot+length);i++)copy[i]=status;
  return copy;
}

export function payrollScenario(base={}, {stops=0,perStop=15,tipDelta=0,detentionMinutes=0,detentionHourly=25}={}) {
  const value=(v,lo,hi)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):lo;
  const addStops=Math.round(value(stops,0,30));
  const extraDetention=Math.round(value(detentionMinutes,0,480));
  const deltaTips=value(tipDelta,0,300);
  const extraStopPay=addStops*value(perStop,0,150);
  const extraDetentionPay=(extraDetention/60)*value(detentionHourly,0,100);
  const initial=['base','stops','detention','tips','bonus'].reduce((sum,k)=>{
    const num=Number(base[k]);
    return sum+(Number.isFinite(num)&&num>0?num:0);
  },0);
  const total=initial+extraStopPay+extraDetentionPay+deltaTips;
  return {initial,extraStopPay,extraDetentionPay,deltaTips,
    total:Math.round(total*100)/100,
    added:Math.round((total-initial)*100)/100,
    effectiveAddPerStop:addStops?Math.round((extraStopPay/addStops)*100)/100:null};
}

export function jurisdictionReconciliation(entries=[],odometerMiles=0) {
  const miles=Number(odometerMiles);
  const planned=Number.isFinite(miles)&&miles>=0?miles:null;
  const items=(entries||[]).map(([state,distance])=>({
    state:String(state||'—').toUpperCase().slice(0,3),
    miles:Number.isFinite(Number(distance))?Math.max(0,Number(distance)):0,
  }));
  const sum=Math.round(items.reduce((n,r)=>n+r.miles,0)*10)/10;
  return {items,stateTotalMiles:sum,
    tripTotalMiles:planned,
    differenceMiles:planned==null?null:Math.round((sum-planned)*10)/10,
    matched:planned!==null&&Math.abs(sum-planned)<0.1};
}

export function proofReadiness(completedIds=[],recipient='') {
  const finished=new Set(completedIds);
  const completed=DEMO_CHECKLIST.filter(x=>finished.has(x.id)).length;
  const hasRecipient=String(recipient||'').trim().length>=2;
  return {completed,total:DEMO_CHECKLIST.length,hasRecipient,
    ready:completed===DEMO_CHECKLIST.length&&hasRecipient};
}

const csvCell=value=>{
  const text=String(value??'');
  const neutral=/^\s*[=+@-]/.test(text)?"'"+text:text;
  return '"'+neutral.replaceAll('"','""')+'"';
};
export function dutyScenarioCsv(segments=[],name='Sample driver') {
  const rows=[['Record type','Driver','From','To','Status','Minutes'],
    ...segments.map(x=>['SIMULATED - NOT AN ELD RECORD',name,x.start,x.end,x.status,x.durationMinutes])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}

/** Read-only live mission labels. Does not advance assignments or infer hidden audit events. */
export function nextDriverMissionStatus(assignment, now=Date.now()) {
  const status=assignment?.status||'unknown';
  const state={
    unassigned:['Waiting for dispatch','No driver assignment is recorded.'],
    offered:['Offer awaiting decision','Review the server-authorized offer below.'],
    accepted:['Proceed to pickup','Report arrival using the authorized driver action.'],
    at_pickup:['Verify pickup','Record pickup and required package custody scans.'],
    picked_up:['Ready for transit','Start the delivery route through the authorized action.'],
    in_transit:['Deliver and capture proof','Complete required parcel scans and private ePOD evidence.'],
    delivered:['Delivery completed','Review recorded proof status in the delivery workflow.'],
    cancelled:['Assignment cancelled','Contact dispatch for reassignment.'],
  }[status]||['Status requires review','Refresh and check with dispatch.'];
  const when=assignment?.scheduled_delivery_at;
  const millis=when?Date.parse(when):NaN;
  const timed=Number.isFinite(millis);
  return {status,label:state[0],instructions:state[1],
    scheduleKind:!timed?'unscheduled':status==='delivered'?'completed':
      millis<now?'past-due':millis-now<=2*3600_000?'approaching':'scheduled',
    scheduledDeliveryAt:timed?when:null};
}

export function liveDriverMissionCounts(assignments=[]) {
  const items=Array.isArray(assignments)?assignments:[];
  return {
    total:items.length,
    active:items.filter(x=>['accepted','at_pickup','picked_up','in_transit'].includes(x.status)).length,
    offers:items.filter(x=>x.status==='offered').length,
    delivered:items.filter(x=>x.status==='delivered').length,
  };
}
