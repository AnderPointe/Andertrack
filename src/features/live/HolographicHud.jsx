import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Activity, CircleDot, Compass, Crosshair, Eye, EyeOff, Gauge, MapPinned,
  Maximize2, Minimize2, Pause, Play, Radio, ShieldCheck, ShieldAlert, Sparkles,
} from 'lucide-react';
import {
  hudSnapshot,hudMotionEnabled,safeHudCoordinate,demoHudMission,
} from '../../lib/holographic-hud.js';
import './holographic-hud.css';

const cleanNumber=value=>value==null?'—':Math.round(value).toString();
const digits=value=>value==null?'--':String(Math.round(value)).padStart(2,'0');
const ageText=seconds=>seconds==null?'—':
  seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+(seconds%60)+'s';

function Reticle({animated}) {
  return <div className="at-hud-target" aria-hidden="true">
    <span className="at-hud-target-ring one"/>
    <span className="at-hud-target-ring two"/>
    <span className="at-hud-target-cross horizontal"/>
    <span className="at-hud-target-cross vertical"/>
    <span className={'at-hud-target-sweep'+(animated?' active':'')}/>
    <span className="at-hud-target-center"/>
  </div>;
}

function RingDial({snapshot,gradientId,animated}) {
  const speed=snapshot.speed;
  const percent=speed==null?0:Math.max(0,Math.min(100,speed/120*100));
  return <div className="at-hud-arc-core">
    <svg viewBox="0 0 520 520" className="at-hud-dial"
      role="img"
      aria-label={speed==null?'Circular heads-up-display dial. Current speed unavailable':
        'Circular heads-up-display dial. Reported speed '+Math.round(speed)+' miles per hour'}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#26efe3"/><stop offset="51%" stopColor="#59cbe9"/>
          <stop offset="100%" stopColor="#ff9d47"/>
        </linearGradient>
        <filter id={gradientId+'-glow'} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="260" cy="260" r="211" className="at-hud-outer-guide"/>
      <g className={'at-hud-ring at-hud-spin-cw'+(animated?' running':'')}>
        <circle cx="260" cy="260" r="208" strokeDasharray="1.5 5.8"
          strokeWidth="8" stroke="#3bd8d1" opacity=".54" fill="none"/>
        <circle cx="260" cy="260" r="193" strokeDasharray="78 48 29 72 10 65"
          strokeWidth="2" stroke="#78fbf1" opacity=".75" fill="none"/>
      </g>
      <g className={'at-hud-ring at-hud-spin-ccw'+(animated?' running':'')}>
        <circle cx="260" cy="260" r="175" strokeDasharray="12 14 39 28"
          strokeWidth="11" stroke="#ff9c43" opacity=".8" fill="none"/>
        <circle cx="260" cy="260" r="162" strokeDasharray="2 11" strokeWidth="3"
          stroke="#39aeb4" opacity=".85" fill="none"/>
      </g>
      <circle cx="260" cy="260" r="150" className="at-hud-track"/>
      <circle cx="260" cy="260" r="150" fill="none" stroke={'url(#'+gradientId+')'}
        strokeWidth="12" strokeLinecap="round" pathLength="100"
        strokeDasharray={percent+' '+(100-percent)} transform="rotate(-90 260 260)"
        className="at-hud-speed-stroke"
        filter={'url(#'+gradientId+'-glow)'}/>
      <circle cx="260" cy="260" r="130" fill="none" stroke="#68eef6"
        strokeDasharray="1 11" strokeWidth="2" opacity=".58"/>
      <g className={'at-hud-ring at-hud-spin-cw-slow'+(animated?' running':'')}>
        <path d="M260 115 L260 136 M260 384 L260 405 M115 260 L136 260 M384 260 L405 260"
          stroke="#3cece4" strokeWidth="3"/>
        <path d="M166 166 L176 176 M344 344 L354 354 M166 354 L176 344 M344 176 L354 166"
          stroke="#ff9c43" strokeWidth="2" opacity=".75"/>
      </g>
      <circle cx="260" cy="260" r="115" fill="#061620" fillOpacity=".76"
        stroke="#63c6ca" strokeOpacity=".25" strokeWidth="1"/>
      <path d="M250 135 L260 124 L270 135 M250 385 L260 396 L270 385"
        fill="none" stroke="#43d9e1" strokeWidth="2" opacity=".6"/>
      <g className="at-hud-core-polygon" opacity=".35">
        <path d="M260 149 L355 205 L355 315 L260 370 L165 315 L165 205 Z"
          stroke="#3cd7db" strokeWidth="1.4" fill="none"/>
        <path d="M260 169 L335 213 L335 307 L260 350 L185 307 L185 213 Z"
          stroke="#ef9a4d" strokeWidth="1" fill="none"/>
      </g>
    </svg>
    <div className="at-hud-dial-readout">
      <span className="at-hud-dial-top">{snapshot.isDemo?'SYNTHETIC TELEMETRY':'DEVICE TELEMETRY'}</span>
      <strong className="at-hud-speed-value">{digits(speed)}</strong>
      <span className="at-hud-speed-unit">MPH · REPORTED</span>
      <span className="at-hud-core-caption">{snapshot.gpsFresh?'GPS LINK ACTIVE':'NO CURRENT GPS'}</span>
    </div>
  </div>;
}

export default function HolographicHud({
  isDemo=false,person=null,location=null,dutyStatus=null,assignment=null,locked=false,
}) {
  const [enabled,setEnabled]=useState(true);
  const [expanded,setExpanded]=useState(true);
  const [motionRequested,setMotionRequested]=useState(Boolean(isDemo));
  const [prefersReducedMotion,setPrefersReducedMotion]=useState(false);
  const [pageVisible,setPageVisible]=useState(true);
  const [now,setNow]=useState(()=>Date.now());
  const gradientId=useId().replaceAll(':','-');
  useEffect(()=>{
    if(typeof window==='undefined' || !window.matchMedia)return undefined;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.('change',update);
    return ()=>media.removeEventListener?.('change',update);
  },[]);
  useEffect(()=>{
    if(typeof document==='undefined')return undefined;
    const onVisibility=()=>setPageVisible(!document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange',onVisibility);
    const timer=window.setInterval(()=>{if(!document.hidden)setNow(Date.now());},30000);
    return ()=>{document.removeEventListener('visibilitychange',onVisibility);window.clearInterval(timer);};
  },[]);
  const snapshot=useMemo(()=>hudSnapshot({isDemo,person,location,dutyStatus,now}),
    [isDemo,person,location,dutyStatus,now]);
  const motionEnabled=hudMotionEnabled({
    visible:enabled&&pageVisible,requested:motionRequested,
    reducedMotion:prefersReducedMotion,movingLive:snapshot.movingLive,
  });
  const mission=demoHudMission(person,assignment);
  if(locked)return null;
  return <section className={'at-hud '+(!expanded?'at-hud-compact':'')+
    (!motionEnabled?' at-hud-static':'')+(enabled?'':' at-hud-off')}
    aria-label="Futuristic driver heads-up display — operational indicators only"
    data-motion={motionEnabled?'on':'off'}>
    <div className="at-hud-head">
      <div className="at-hud-brand">
        <div className="at-hud-brand-orb"><CircleDot size={23}/></div>
        <div><span className="at-hud-eyebrow">ANDERTRACK / HOLOGRAPHIC COMMAND INTERFACE</span>
          <h3>ARC<span>VIEW</span> HUD <small>V1.0</small></h3>
        </div>
      </div>
      <div className="at-hud-switches">
        <span className={'at-hud-source '+(isDemo?'demo':snapshot.gpsFresh?'fresh':'offline')}>
          <span className="at-hud-signal-dot"/>{snapshot.gpsState}
        </span>
        <button type="button" onClick={()=>setMotionRequested(v=>!v)}
          disabled={!enabled||prefersReducedMotion||snapshot.movingLive}
          title={prefersReducedMotion?'System reduced-motion preference active':
            snapshot.movingLive?'Animation disabled while vehicle is moving':
            'Toggle decorative motion'}
          aria-label={motionRequested?'Pause HUD animations':'Resume HUD animations'}
          aria-pressed={motionEnabled} className="at-hud-tool">
          {motionEnabled?<Pause size={15}/>:<Play size={15}/>}
          <span>{motionEnabled?'Pause motion':'Motion off'}</span>
        </button>
        <button type="button" onClick={()=>setExpanded(v=>!v)}
          aria-expanded={expanded} aria-label={expanded?'Compact HUD':'Expand HUD'}
          className="at-hud-tool">
          {expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}
          <span>{expanded?'Compact':'Expand'}</span>
        </button>
        <button type="button" onClick={()=>setEnabled(v=>!v)}
          aria-pressed={enabled} className="at-hud-tool">
          {enabled?<EyeOff size={15}/>:<Eye size={15}/>}
          <span>{enabled?'Hide HUD':'Show HUD'}</span>
        </button>
      </div>
    </div>
    {enabled&&<div className="at-hud-body">
      <div className="at-hud-grid-overlay" aria-hidden="true"/>
      <div className={'at-hud-beam '+(motionEnabled?'running':'')} aria-hidden="true"/>
      <div className="at-hud-left at-hud-side">
        <div className="at-hud-telemetry-card">
          <div className="at-hud-card-title"><Radio size={14}/> SYSTEM FEED <i/></div>
          <div className="at-hud-readout"><small>DEVICE / VEHICLE</small><strong>{snapshot.unit}</strong></div>
          <div className="at-hud-readout"><small>GPS UPDATE AGE</small><strong>{ageText(snapshot.secondsAgo)}</strong></div>
          <div className="at-hud-readout"><small>GPS ACCURACY</small>
            <strong>{snapshot.accuracy==null?'—':Math.round(snapshot.accuracy)+' m'}</strong></div>
          <div className="at-hud-readout"><small>BATTERY TELEMETRY</small>
            <strong>{snapshot.battery==null?'NOT REPORTED':snapshot.battery+'%'}</strong></div>
          <div className="at-hud-signal-bars" aria-hidden="true">
            {Array.from({length:17},(_,i)=><span key={i}
              style={{'--bar-h':(18+(i*17%57))+'%','--delay':(i*57)+'ms'}}/>)}
          </div>
        </div>
        <div className="at-hud-telemetry-card at-hud-coordinates">
          <div className="at-hud-card-title"><MapPinned size={14}/> POSITION VECTOR</div>
          <div className="at-hud-readout"><small>LATITUDE</small>
            <strong>{safeHudCoordinate(snapshot.position?.latitude)}</strong></div>
          <div className="at-hud-readout"><small>LONGITUDE</small>
            <strong>{safeHudCoordinate(snapshot.position?.longitude,'lng')}</strong></div>
          <div className="at-hud-readout"><small>COURSE HEADING</small>
            <strong>{snapshot.heading==null?'—':Math.round(snapshot.heading)+'° '+snapshot.headingPoint}</strong></div>
        </div>
      </div>
      <div className="at-hud-center">
        <div className="at-hud-center-overline"><Crosshair size={13}/> FLIGHT-DECK / VEHICLE DISPLAY</div>
        <RingDial snapshot={snapshot} gradientId={gradientId} animated={motionEnabled}/>
        <div className="at-hud-dial-footer"><span><i/> {snapshot.isDemo?'SIMULATION':'AUTHORIZED FEED'}</span>
          <span>{snapshot.movingLive?'MOTION SUPPRESSED / MOVING VEHICLE':
            motionEnabled?'HUD VISUAL EFFECTS ACTIVE':'STATIC DISPLAY MODE'}</span></div>
      </div>
      <div className="at-hud-right at-hud-side">
        <div className="at-hud-telemetry-card at-hud-vector-card">
          <div className="at-hud-card-title"><Compass size={14}/> DIRECTIONAL TARGET</div>
          <Reticle animated={motionEnabled}/>
          <div className="at-hud-vector-row"><small>HEADING</small>
            <strong>{snapshot.heading==null?'NOT REPORTED':snapshot.headingPoint+' / '+Math.round(snapshot.heading)+'°'}</strong></div>
          <div className="at-hud-vector-row"><small>MISSION LINK</small>
            <strong>{snapshot.isDemo?'DEMO READY':assignment?'ASSIGNED':'NOT ASSIGNED'}</strong></div>
        </div>
        <div className="at-hud-telemetry-card">
          <div className="at-hud-card-title"><Gauge size={14}/> OPERATOR STATUS</div>
          <div className="at-hud-readout"><small>DUTY STATUS SOURCE</small>
            <strong>{snapshot.isDemo?'SIMULATED / '+snapshot.duty:'ELD NOT CONNECTED'}</strong></div>
          <div className="at-hud-readout"><small>HEALTH SIGNAL</small>
            <strong>{snapshot.isDemo?'DEMO ONLY':'NOT CONNECTED'}</strong></div>
          <div className="at-hud-readout"><small>NAVIGATION ENGINE</small><strong>EXTERNAL ONLY</strong></div>
        </div>
      </div>
      <div className="at-hud-mission-strip">
        <div><span>ACTIVE SHIPMENT</span><strong>{mission.title}</strong></div>
        <div><span>DESTINATION</span><strong>{mission.destination}</strong></div>
        <span className="at-hud-mission-lock"><ShieldCheck size={13}/>
          {isDemo?'NO REAL SHIPMENT DATA':'ROLE SCOPED'}</span>
      </div>
    </div>}
    <div className="at-hud-foot"><span><ShieldAlert size={14}/>
      {isDemo?'Animated visual demo only — all readings on this HUD are synthetic.':
        'No integrated navigation, ELD, biometrics or calculated ETA. Only authorized recent GPS is displayed.'}</span>
      <span><Activity size={13}/>{prefersReducedMotion?'ACCESSIBILITY / MOTION DISABLED':
        snapshot.movingLive?'DRIVING SAFETY / ANIMATION LOCKED':
        'MOTION IS DECORATIVE'}</span></div>
  </section>;
}
