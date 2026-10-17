import { validGpsPosition, freshGpsPosition } from './operations.js';

// Explainable heuristics for dashboard triage, not AI predictions or compliance violations.
// Only use data already returned by organization-scoped Supabase RLS queries.
const MINUTE = 60_000;

export function deriveOperationalAlerts({
  assignments = [], requests = [], drivers = [], locations = [], planner = true, userId = '',
}, now = Date.now()) {
  const alerts = [];
  const queue = [...requests].filter(r => r?.status === 'queued' && (planner || r.driver_user_id === userId))
    .sort((a,b) => Number(a.queue_number) - Number(b.queue_number));
  const scopedDrivers = planner ? drivers : drivers.filter(d => d.user_id === userId);
  const scopedLocations = planner ? locations : [];
  const scopedAssignments = planner ? assignments : assignments.filter(a => a.driver_user_id === userId);

  queue.forEach((item, index) => {
    const requested = Date.parse(item.requested_at);
    if (!Number.isFinite(requested) || requested > now) return;
    const minutes = Math.floor((now-requested)/MINUTE);
    if (minutes < 15) return;
    const driver = scopedDrivers.find(d => d.user_id === item.driver_user_id);
    alerts.push({
      id:'queue:'+item.id,kind:'queue',severity:minutes>=30?'high':'medium',
      title:index===0?'Oldest request is waiting':'Assignment request waiting',
      detail:(driver?.display_name || 'Queued driver')+' has waited '+minutes+' minutes. Review the dispatch queue.',
      view:'dispatch',createdAt:item.requested_at,requestId:item.id,
    });
  });

  if (planner) {
    scopedAssignments.filter(a => a.status === 'unassigned').forEach(a => {
      const created = Date.parse(a.created_at);
      if (!Number.isFinite(created) || created > now || now-created < 60*MINUTE) return;
      const minutes = Math.floor((now-created)/MINUTE);
      alerts.push({
        id:'unassigned:'+a.id,kind:'load',severity:'medium',
        title:'Unassigned load to review',
        detail:(a.reference || 'Load')+' has been unassigned for '+minutes+' minutes (since creation).',
        view:'dispatch',assignmentId:a.id,createdAt:a.created_at,
      });
    });
    scopedDrivers.filter(d => d.availability === 'available' && !d.license_verified).forEach(d => {
      alerts.push({
        id:'license:'+d.user_id,kind:'driver',severity:'medium',
        title:'Driver onboarding needs attention',
        detail:(d.display_name || 'Driver')+' is marked available but license verification is pending.',
        view:'fleet',createdAt:null,driverId:d.user_id,
      });
    });
    scopedLocations.forEach(l => {
      const identity=l.id || l.driver_id;
      if (!identity) return;
      if (!validGpsPosition(l)) {
        alerts.push({
          id:'invalid-gps:'+identity,kind:'gps',severity:'medium',
          title:'GPS position unavailable',
          detail:(l.unit_number||'Fleet unit')+' has an invalid or missing reported position.',
          view:'tracking',createdAt:l.last_ping_at,
        });
        return;
      }
      if (freshGpsPosition(l,now)) return;
      const age=now-Date.parse(l.last_ping_at);
      if (!Number.isFinite(age) || age < 0) return;
      const minutes=Math.floor(age/MINUTE);
      if (minutes < 10) return;
      alerts.push({
        id:'stale-gps:'+identity,kind:'gps',
        severity:minutes>=60?'high':'medium',
        title:'Fleet location is stale',
        detail:(l.unit_number||'Fleet unit')+' last reported '+minutes+' minutes ago. This does not prove the vehicle is offline.',
        view:'tracking',createdAt:l.last_ping_at,
      });
    });
  }
  const severity={high:0,medium:1,info:2};
  return alerts.sort((a,b)=>(severity[a.severity]-severity[b.severity])||
    (Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0)).slice(0,80);
}

export function deriveActivityStream({
  assignments=[], requests=[], locations=[], planner=true, userId='',
}, now=Date.now()) {
  const activity=[];
  (planner?assignments:assignments.filter(a=>a.driver_user_id===userId)).forEach(a=>{
    const timestamp=Date.parse(a.created_at);
    if(!Number.isFinite(timestamp)||timestamp>now) return;
    activity.push({id:'load:'+a.id,kind:'load',title:'Load created',detail:(a.reference||'Shipment')+' · '+(a.customer_name||'Customer'),
      at:a.created_at,view:'dispatch',assignmentId:a.id});
  });
  requests.filter(r=>planner||r.driver_user_id===userId).forEach(r=>{
    const timestamp=Date.parse(r.requested_at);
    if(!Number.isFinite(timestamp)||timestamp>now)return;
    activity.push({id:'queue:'+r.id,kind:'queue',title:'Assignment requested',detail:'Request #'+r.queue_number,
      at:r.requested_at,view:'dispatch'});
  });
  if(planner) locations.forEach(l=>{
    if(!l.last_ping_at || !validGpsPosition(l))return;
    const timestamp=Date.parse(l.last_ping_at);
    if(!Number.isFinite(timestamp)||timestamp>now)return;
    activity.push({id:'gps:'+(l.id||l.driver_id),kind:'gps',title:'GPS reported',
      detail:l.unit_number||'Fleet unit',at:l.last_ping_at,view:'tracking'});
  });
  return activity.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,12);
}

function csvCell(value) {
  // Neutralize spreadsheet formula injection, even when users export customer-supplied text.
  const raw=String(value??'');
  const safe=/^[\s]*[=+@-]/.test(raw) ? "'"+raw : raw;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function shipmentCsv(assignments) {
  const fields=[
    ['Reference','reference'],['Customer','customer_name'],['Division','division'],
    ['Pickup','pickup_address'],['Delivery','dropoff_address'],['Commodity','commodity'],
    ['Status','status'],['Miles','estimated_miles'],['Created UTC','created_at'],
  ];
  return [fields.map(f=>csvCell(f[0])).join(','),...(assignments||[]).map(a=>
    fields.map(f=>csvCell(a[f[1]])).join(','))].join('\r\n');
}
