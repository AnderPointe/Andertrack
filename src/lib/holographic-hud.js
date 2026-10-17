import { validGpsPosition, freshGpsPosition } from './operations.js';

// HUD telemetry is presentation-only and deliberately excludes invented live
// HOS, biometric, earnings, fatigue, ETA and regulatory navigation readings.
const finite = value => value == null || value === '' || !Number.isFinite(Number(value))
  ? null : Number(value);
const bounded = (value,min,max) => {
  const n=finite(value);
  return n==null || n<min || n>max ? null : n;
};

export function compassPoint(value) {
  const heading=bounded(value,0,360);
  if(heading==null)return '—';
  const directions=['N','NE','E','SE','S','SW','W','NW'];
  return directions[Math.round((heading%360)/45)%8];
}

export function hudSnapshot({isDemo=false,location=null,person=null,dutyStatus=null,now=Date.now()}={}) {
  const allowedPoint=validGpsPosition(location);
  const gpsFresh=allowedPoint && freshGpsPosition(location,now);
  const speed=gpsFresh?bounded(location?.speed_mph,0,160):null;
  const heading=gpsFresh?bounded(location?.heading,0,360):null;
  const age=allowedPoint&&location?.last_ping_at?Date.parse(location.last_ping_at):NaN;
  const secondsAgo=Number.isFinite(age)&&age<=now?
    Math.max(0,Math.floor((now-age)/1000)):null;
  const battery=gpsFresh?bounded(location?.battery_percent,0,100):null;
  const accuracy=gpsFresh?bounded(location?.accuracy_meters,0,5000):null;
  const unit=isDemo ? (person?.unit||'SAMPLE VEHICLE')
    : gpsFresh ? (location?.unit_number||'Driver GPS') : 'NO GPS SIGNAL';
  const gpsState=isDemo?'SYNTHETIC DEMO':gpsFresh?'RECENT GPS':'GPS UNAVAILABLE';
  const position=gpsFresh?{
    latitude:Number(location.latitude),longitude:Number(location.longitude),
  }:null;
  return {
    isDemo,unit,gpsState,gpsFresh:Boolean(gpsFresh),
    speed,heading,headingPoint:compassPoint(heading),secondsAgo,battery,accuracy,
    position,
    duty:isDemo?(dutyStatus||person?.status||'UNKNOWN'):'NOT CONNECTED',
    signalNote:isDemo?'Fictional position / telemetry':
      gpsFresh?'GPS position from authorized feed':'No authorized recent GPS position',
    // On the road avoid visual distraction regardless of theme toggle state.
    movingLive:!isDemo && gpsFresh && speed!=null && speed>5,
  };
}

export function hudMotionEnabled({visible=true,requested=false,reducedMotion=false,movingLive=false}={}) {
  return Boolean(visible&&requested&&!reducedMotion&&!movingLive);
}

export function safeHudCoordinate(value,direction='lat') {
  const limit=direction==='lng'?180:90;
  const n=bounded(value,-limit,limit);
  return n==null?'—':n.toFixed(4)+'°';
}

export function demoHudMission(person,assignment) {
  const title=String(assignment?.reference||person?.reference||'NO ACTIVE MISSION').slice(0,70);
  const destination=String(assignment?.dropoff_address||person?.address||'Not assigned').slice(0,120);
  return {title,destination};
}
