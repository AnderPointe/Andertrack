import { validGpsPosition, freshGpsPosition } from './operations.js';

const RAD = Math.PI / 180;
const EARTH_MILES = 3958.7613;
export const HISTORY_WINDOWS = Object.freeze({ '6h': 6 * 3600000, '24h': 24 * 3600000, '7d': 7 * 86400000 });
export const DEFAULT_GEOFENCE_MILES = 5;

/** Great-circle straight-line distance between two recorded coordinates. Never a routed/road distance. */
export function geoDistanceMiles(a,b) {
  if (!validGpsPosition(a) || !validGpsPosition(b)) return null;
  const lat1=Number(a.latitude)*RAD, lat2=Number(b.latitude)*RAD;
  const deltaLat=(Number(b.latitude)-Number(a.latitude))*RAD;
  const deltaLon=(Number(b.longitude)-Number(a.longitude))*RAD;
  const hav=Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLon/2)**2;
  return 2*EARTH_MILES*Math.asin(Math.min(1,Math.sqrt(hav)));
}

/** No future, duplicate-time, inaccurate or invalid points in replay; max 500 samples. */
export function replayPoints(events=[], now=Date.now(), maxAccuracyMeters=200) {
  const timeCache=new Set();
  return (events||[]).filter(p=>{
    if (!validGpsPosition(p)) return false;
    const ts=Date.parse(p.recorded_at || '');
    const accuracy=p.accuracy_meters==null ? null : Number(p.accuracy_meters);
    if (!Number.isFinite(ts) || ts>now || ts<=0 ||
        (accuracy!==null && (!Number.isFinite(accuracy) || accuracy<0 || accuracy>maxAccuracyMeters))) return false;
    const key=p.driver_id+':'+ts;
    if (timeCache.has(key)) return false;
    timeCache.add(key);
    return true;
  }).sort((a,b)=>Date.parse(a.recorded_at)-Date.parse(b.recorded_at)).slice(-500);
}

export function traceSummary(events=[]) {
  const points=replayPoints(events);
  let traceDistance=0, segments=0, suspectJumps=0, maxReportedSpeed=null;
  for(let i=0;i<points.length;i++){
    const speed=Number(points[i].speed_mph);
    if(points[i].speed_mph!=null && Number.isFinite(speed) && speed>=0)
      maxReportedSpeed=Math.max(maxReportedSpeed??0,speed);
    if(i===0)continue;
    const miles=geoDistanceMiles(points[i-1],points[i]);
    const elapsed=(Date.parse(points[i].recorded_at)-Date.parse(points[i-1].recorded_at))/3600000;
    if(miles==null || elapsed<=0 || miles/elapsed>125){suspectJumps++;continue;}
    traceDistance+=miles;
    segments++;
  }
  return {
    points:points.length, segments, suspectJumps,
    straightSegmentMiles:Math.round(traceDistance*10)/10,
    maxReportedSpeedMph:maxReportedSpeed==null?null:Math.round(maxReportedSpeed),
    firstAt:points[0]?.recorded_at||null,
    lastAt:points.at(-1)?.recorded_at||null,
  };
}

export function fencePosition(position, fence) {
  if(!validGpsPosition(position) || !validGpsPosition(fence))return 'unknown';
  const radius=Number(fence.radiusMiles);
  if(!Number.isFinite(radius)||radius<=0||radius>500)return 'unknown';
  const miles=geoDistanceMiles(position,fence);
  return miles <= radius ? 'inside' : 'outside';
}

export function fleetObservations(locations=[],fence=null,now=Date.now()) {
  const issues=[];
  (locations||[]).forEach(l=>{
    if(!validGpsPosition(l))return;
    const id=l.id||l.driver_id||l.unit_number;
    if(!id)return;
    const unit=l.unit_number||'GPS unit';
    if(!freshGpsPosition(l,now)){
      issues.push({id:'stale:'+id,kind:'stale',severity:'medium',
        title:'Location not recently reported',detail:unit+' has no current GPS ping.'});
      return;
    }
    const speed=l.speed_mph==null?null:Number(l.speed_mph);
    if(speed!=null && Number.isFinite(speed) && speed>80){
      issues.push({id:'speed:'+id,kind:'speed',severity:'medium',
        title:'Reported speed above review threshold',detail:unit+' reported '+Math.round(speed)+' mph. Review context; this is not a speeding determination.'});
    }
    if(fence&&fencePosition(l,fence)==='outside'){
      issues.push({id:'fence:'+id,kind:'fence',severity:'high',
        title:'Outside the local monitoring circle',detail:unit+' is outside the selected monitoring radius. This is not an automated geofence event.'});
    }
  });
  return issues;
}
