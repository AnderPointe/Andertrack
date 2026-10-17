import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity,AudioLines,CheckCircle2,ChevronRight,Compass,Crosshair,Expand,
  Eye,EyeOff,Headphones,Layers,MapPinned,Maximize2,Mic,MicOff,Minimize2,
  Navigation,Pause,Play,Radio,ScanLine,ShieldAlert,ShieldCheck,Terminal,
  Truck,Volume2,VolumeX,X,
} from 'lucide-react';
import {hudSnapshot,safeHudCoordinate} from '../../lib/holographic-hud.js';
import {validGpsPosition} from '../../lib/operations.js';
import {
  CINEMA_COMMANDS,parseCinemaCommand,cinemaSafety,cinemaDiagnostics,
} from '../../lib/arcview-cinema.js';
import './arcview-cinema.css';

function labelValue(value) {return value==null?'—':String(value);}
function clockTime(value) {
  if(!value)return 'Not reported';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'Not reported':d.toLocaleString();
}

function CinemaMap({location,snapshot,effects,recenter,mode,interactive}) {
  const host=useRef(null);
  const map=useRef(null);
  const layer=useRef(null);
  const centered=useRef(false);
  const lastRecenter=useRef(0);
  useEffect(()=>{
    if(mode!=='map'||!host.current)return undefined;
    const instance=L.map(host.current,{zoomControl:false,scrollWheelZoom:false,preferCanvas:true,
      dragging:interactive, touchZoom:interactive, doubleClickZoom:interactive,
      boxZoom:interactive,keyboard:interactive})
      .setView([38.6,-96.6],4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:18,minZoom:3,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(instance);
    if(interactive)L.control.zoom({position:'bottomright'}).addTo(instance);
    const group=L.featureGroup().addTo(instance);
    map.current=instance;layer.current=group;
    const observer=typeof ResizeObserver!=='undefined'
      ?new ResizeObserver(()=>instance.invalidateSize({pan:false})):null;
    observer?.observe(host.current);
    const onResize=()=>instance.invalidateSize({pan:false});
    document.addEventListener('fullscreenchange',onResize);
    return ()=>{
      document.removeEventListener('fullscreenchange',onResize);
      observer?.disconnect();instance.remove();map.current=null;layer.current=null;centered.current=false;
    };
  },[mode,interactive]);
  useEffect(()=>{
    if(!map.current||!layer.current)return;
    layer.current.clearLayers();
    const point=snapshot.gpsFresh && validGpsPosition(location) ? snapshot.position : null;
    if(!point)return;
    const coords=[point.latitude,point.longitude];
    const accuracy=snapshot.accuracy;
    if(accuracy!=null){
      L.circle(coords,{radius:Math.max(1,accuracy),color:'#53efe3',weight:1,
        fillColor:'#39c3d7',fillOpacity:.08,dashArray:'6 5',interactive:false}).addTo(layer.current);
    }
    const dot=L.circleMarker(coords,{radius:11,color:'#f6ffff',weight:2,
      fillColor:'#ff9d4b',fillOpacity:1}).addTo(layer.current);
    const tooltip=document.createElement('span');
    tooltip.textContent=String(snapshot.unit||'GPS location')+' · Reported position';
    dot.bindTooltip(tooltip);
    if(!centered.current){map.current.setView(coords,13);centered.current=true;}
  },[snapshot,location]);
  useEffect(()=>{
    if(recenter!==lastRecenter.current){
      lastRecenter.current=recenter;
      if(map.current&&snapshot.gpsFresh&&snapshot.position){
        map.current.setView([snapshot.position.latitude,snapshot.position.longitude],14,{animate:false});
      }
    }
  },[recenter,snapshot]);
  if(mode!=='map')return null;
  return <div className="at-cinema-map-wrap" aria-label="Large read-only vehicle position map">
    <div className="at-cinema-map" ref={host} role="region" aria-label="Reported vehicle position on OpenStreetMap"/>
    <div className="at-cinema-map-grid" aria-hidden="true"/>
    <div className={'at-cinema-map-reticle'+(effects?' running':'')} aria-hidden="true">
      <i/><i/><i/>
    </div>
    <div className="at-cinema-map-top"><ScanLine size={17}/> GEO-SPATIAL HOLOGRAPHIC MATRIX
      <span>{snapshot.isDemo?'SYNTHETIC GPS':'AUTHORIZED POSITION ONLY'}</span></div>
    <div className="at-cinema-map-bottom">
      <span><Crosshair size={13}/> LAT {safeHudCoordinate(snapshot.position?.latitude)}</span>
      <span>LON {safeHudCoordinate(snapshot.position?.longitude,'lng')}</span>
      <span><Compass size={13}/> {snapshot.headingPoint} / {snapshot.heading==null?'—':Math.round(snapshot.heading)+'°'}</span>
    </div>
    {!snapshot.gpsFresh&&<div className="at-cinema-map-empty">
      <MapPinned size={30}/><strong>NO VERIFIED POSITION</strong>
      <small>Live movement and routes are not simulated. Connect an authorized GPS feed.</small>
    </div>}
  </div>;
}

function DiagnosticPanel({snapshot,location,isDemo}) {
  const items=cinemaDiagnostics(snapshot,location);
  return <div className="at-cinema-detail-panel">
    <span className="at-cinema-kicker"><Activity size={15}/> LAYERED VEHICLE TELEMETRY</span>
    <h3>Systems Diagnostic Matrix</h3>
    <p>Source-qualified device readings only. Engine sensors, ELD and health telemetry are not connected.</p>
    <div className="at-cinema-diag-grid">
      {items.map((item,index)=><article key={item.id} className="at-cinema-diag-item">
        <div className="at-cinema-diag-head"><span>SYS–{String(index+1).padStart(2,'0')}</span>
          {item.good?<CheckCircle2 size={15}/>:<Activity size={15}/>}</div>
        <small>{item.label}</small><strong>{item.value}</strong>
        <div className="at-cinema-diag-bars" aria-hidden="true">
          {Array.from({length:14},(_,i)=><i key={i} className={i<(item.value==='NOT CONNECTED'?0:8)?'active':''}/>)}
        </div>
      </article>)}
    </div>
    <div className="at-cinema-disclaimer"><ShieldCheck size={15}/>
      {isDemo?'All on-screen device readings are sample data.':
        'A missing signal is never interpreted as a healthy vehicle or a completed diagnostic scan.'}</div>
  </div>;
}

function MissionPanel({assignment,isDemo}) {
  return <div className="at-cinema-detail-panel">
    <span className="at-cinema-kicker"><Navigation size={15}/> AUTHORIZED SHIPMENT INTELLIGENCE</span>
    <h3>Mission Command</h3>
    <p>{isDemo?'Illustrative mission, not a customer record.':
      'Read-only details from your assigned load. Actions remain in the protected Driver Cockpit workflow.'}</p>
    <div className="at-cinema-mission-data">
      {[
        ['Mission identifier',assignment?.reference||'No assigned mission'],
        ['Current status',assignment?.status?.replaceAll('_',' ')||'Not assigned'],
        ['Pickup address',assignment?.pickup_address||'Not provided'],
        ['Destination',assignment?.dropoff_address||'Not provided'],
        ['Scheduled delivery',clockTime(assignment?.scheduled_delivery_at)],
        ['Cargo details',assignment?.commodity||'Not provided'],
      ].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}
    </div>
    <div className="at-cinema-disclaimer"><ShieldAlert size={15}/>
      No turn-by-turn maneuvers or safe-truck routing are generated. Use authorized dispatch controls to change any load status.</div>
  </div>;
}

export default function ArcviewCinema({
  isDemo=false,person=null,location=null,dutyStatus=null,assignment=null,locked=false,
}) {
  const rootRef=useRef(null);
  const speechRef=useRef(null);
  const wasFullscreen=useRef(false);
  const inputRef=useRef(null);
  const [open,setOpen]=useState(false);
  const [nativeFullscreen,setNativeFullscreen]=useState(false);
  const [tab,setTab]=useState('map');
  const [effectsRequested,setEffectsRequested]=useState(Boolean(isDemo));
  const [recenter,setRecenter]=useState(0);
  const [command,setCommand]=useState('');
  const [notice,setNotice]=useState('ARCVIEW display console ready. Say or type “help”.');
  const [voiceStatus,setVoiceStatus]=useState('idle');
  const [micError,setMicError]=useState('');
  const [reduceMotion,setReduceMotion]=useState(false);
  const [visible,setVisible]=useState(true);
  const [now,setNow]=useState(()=>Date.now());
  const snapshot=useMemo(()=>hudSnapshot({isDemo,person,location,dutyStatus,now}),
    [isDemo,person,location,dutyStatus,now]);
  const safety=cinemaSafety({isDemo,speed:snapshot.speed,gpsFresh:snapshot.gpsFresh});
  const effects=open&&effectsRequested&&visible&&!reduceMotion&&safety.allowEffects;
  const speechAvailable=typeof window!=='undefined' &&
    Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
  useEffect(()=>{
    if(typeof window==='undefined'||!window.matchMedia)return undefined;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler=()=>setReduceMotion(media.matches);
    handler();media.addEventListener?.('change',handler);
    return ()=>media.removeEventListener?.('change',handler);
  },[]);
  useEffect(()=>{
    if(!open)return undefined;
    const onVisibility=()=>setVisible(!document.hidden);
    onVisibility();document.addEventListener('visibilitychange',onVisibility);
    const timer=window.setInterval(()=>{if(!document.hidden)setNow(Date.now());},15000);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisibility);};
  },[open]);
  const stopSpeech=useCallback(()=>{
    if(speechRef.current){try{speechRef.current.abort();}catch{/* browser closed microphone */}}
    speechRef.current=null;
    setVoiceStatus('idle');
  },[]);
  const close=useCallback(()=>{
    stopSpeech();
    if(document.fullscreenElement===rootRef.current){
      document.exitFullscreen?.().catch(()=>{});
    }
    setOpen(false);setNativeFullscreen(false);
  },[stopSpeech]);
  const executeRef=useRef(null);
  const execute=useCallback((raw)=>{
    const parsed=parseCinemaCommand(raw);
    setCommand('');
    if(!parsed.id){setNotice(parsed.error);return;}
    if(parsed.id==='exit'){close();return;}
    // Do not expose attention-demanding controls when vehicle may be moving
    // or when its movement status cannot be verified.
    if(!safety.stationaryConfirmed){
      setNotice('Cockpit interactions locked: '+safety.reason+'.');return;
    }
    switch(parsed.id){
      case 'map':setTab('map');break;
      case 'diagnostics':setTab('diagnostics');break;
      case 'mission':setTab('mission');break;
      case 'center':setTab('map');setRecenter(n=>n+1);break;
      case 'pause':setEffectsRequested(false);break;
      case 'resume':setEffectsRequested(true);break;
      case 'help':break;
      default:break;
    }
    setNotice(parsed.id==='help'?'Available: '+CINEMA_COMMANDS.map(x=>x.examples[0]).join(' · '):
      'Display command recognized: '+parsed.id+'.');
  },[close,safety.reason,safety.stationaryConfirmed]);
  executeRef.current=execute;
  useEffect(()=>{
    if(!open||!safety.allowVoice||!visible)stopSpeech();
  },[open,safety.allowVoice,visible,stopSpeech]);
  useEffect(()=>{
    if(!open)return undefined;
    const onFull=()=>{
      const active=document.fullscreenElement===rootRef.current;
      setNativeFullscreen(active);
      if(wasFullscreen.current&&!active){stopSpeech();setOpen(false);}
      wasFullscreen.current=active;
    };
    onFull();
    const onKey=event=>{
      if(event.key==='Escape'&&!document.fullscreenElement)close();
    };
    document.addEventListener('fullscreenchange',onFull);
    document.addEventListener('keydown',onKey);
    document.body.classList.add('at-cinema-body-lock');
    return ()=>{
      document.body.classList.remove('at-cinema-body-lock');
      document.removeEventListener('fullscreenchange',onFull);
      document.removeEventListener('keydown',onKey);
    };
  },[open,close,stopSpeech]);
  useEffect(()=>()=>{try{speechRef.current?.abort();}catch{/* unmount */}},[]);
  const launch=()=>{
    if(locked)return;
    wasFullscreen.current=false;
    setTab('map');setOpen(true);setNotice('Cinematic mode ready. Display controls only.');
    const target=rootRef.current;
    if(target?.requestFullscreen){
      try{const request=target.requestFullscreen();Promise.resolve(request).catch(()=>{
        setNotice('Browser fullscreen unavailable; immersive window mode is active.');
      });}catch{setNotice('Browser fullscreen unavailable; immersive window mode is active.');}
    }
  };
  const startSpeech=()=>{
    if(!safety.allowVoice||!open){setMicError('Microphone disabled until a stationary vehicle is confirmed.');return;}
    if(!speechAvailable){setMicError('Voice recognition is not supported here. Type a command instead.');return;}
    stopSpeech();setMicError('');
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const speech=new Recognition();
    speech.continuous=false;
    speech.interimResults=false;
    speech.maxAlternatives=1;
    speech.lang='en-US';
    speechRef.current=speech;
    speech.onstart=()=>setVoiceStatus('listening');
    speech.onresult=event=>{
      const text=event.results?.[0]?.[0]?.transcript||'';
      speechRef.current=null;setVoiceStatus('idle');
      executeRef.current?.(text);
    };
    speech.onerror=event=>{
      speechRef.current=null;setVoiceStatus('idle');
      setMicError('Speech unavailable: '+(event.error||'recognition error')+'. Use typed commands.');
    };
    speech.onend=()=>{speechRef.current=null;setVoiceStatus('idle');};
    try{speech.start();}catch{setVoiceStatus('idle');setMicError('Microphone could not start. Type a command instead.');}
  };
  if(locked)return null;
  return <div ref={rootRef} className={'at-cinema-host'+(open?' at-cinema-open':'')+
    (nativeFullscreen?' at-cinema-native':'')+(effects?' at-cinema-effects':' at-cinema-still')}>
    {!open&&<button type="button" className="at-cinema-launch" onClick={launch}>
      <span className="at-cinema-launch-symbol"><ScanLine size={22}/></span>
      <span><strong>ENTER CINEMATIC COCKPIT{isDemo?' · SAMPLE':''}</strong>
        <small>{isDemo?'Clearly labeled simulation · ':''}Full-screen holographic map · diagnostics · voice-ready controls</small></span>
      <Expand size={19}/>
    </button>}
    {open&&<div className="at-cinema-surface" role="dialog" aria-modal="true"
      aria-label="ARCVIEW immersive driver cockpit" data-effects={effects?'on':'off'}>
      <header className="at-cinema-header">
        <div className="at-cinema-logo"><span className="at-cinema-reactor"><Crosshair size={23}/></span>
          <div><small>ANDERTRACK // FUTURE OPERATIONS SYSTEM</small>
            <strong>ARCVIEW <em>IMMERSIVE</em></strong></div></div>
        <div className="at-cinema-head-info"><span>{isDemo?'SIMULATION / FICTIONAL DATA':
          snapshot.gpsFresh?'LIVE POSITION / AUTHORIZED':'GPS / NOT CONNECTED'}</span>
          <span>{safety.reason}</span></div>
        <div className="at-cinema-head-actions">
          <button type="button" disabled={!safety.allowEffects||reduceMotion}
            onClick={()=>setEffectsRequested(v=>!v)}>
            {effects?<Pause size={16}/>:<Play size={16}/>}
            <span>{effects?'Pause FX':'Motion FX'}</span></button>
          <button type="button" onClick={close} className="at-cinema-exit"><X size={17}/> Exit cockpit</button>
        </div>
      </header>
      <nav className="at-cinema-tabs" aria-label="Cockpit display layers">
        {[
          ['map','Holographic map',MapPinned],
          ['diagnostics','Vehicle diagnostics',Layers],
          ['mission','Mission intelligence',Navigation],
        ].map(([name,text,Icon])=><button type="button" key={name}
          onClick={()=>{if(safety.stationaryConfirmed)setTab(name);}}
          disabled={!safety.stationaryConfirmed} aria-current={tab===name?'page':undefined}
          className={tab===name?'active':''}><Icon size={15}/>{text}</button>)}
      </nav>
      <div className="at-cinema-content">
        <aside className="at-cinema-rail">
          <div className="at-cinema-rail-title"><Radio size={16}/> VEHICLE INTERFACE</div>
          {[
            ['VEHICLE / UNIT',snapshot.unit],
            ['SPEED / REPORTED',snapshot.speed==null?'—':Math.round(snapshot.speed)+' MPH'],
            ['HEADING',snapshot.heading==null?'—':Math.round(snapshot.heading)+'° '+snapshot.headingPoint],
            ['GPS ACCURACY',snapshot.accuracy==null?'—':Math.round(snapshot.accuracy)+' METERS'],
            ['POWER TELEMETRY',snapshot.battery==null?'—':snapshot.battery+'%'],
            ['DRIVER DUTY',isDemo?(dutyStatus||person?.status||'UNKNOWN')+' / DEMO':'ELD NOT CONNECTED'],
          ].map(([name,value])=><div className="at-cinema-rail-stat" key={name}>
            <small>{name}</small><strong>{value}</strong></div>)}
          <div className="at-cinema-diagnostics-health"><ShieldCheck size={15}/>
            {isDemo?'FAKE SENSOR DATA':snapshot.gpsFresh?'GPS DATA RECEIVED':'GPS DATA UNAVAILABLE'}</div>
        </aside>
        <main className="at-cinema-primary">
          <div className="at-cinema-viewport-header">
            <span><Crosshair size={15}/> {tab==='map'?'GEOSPATIAL FIELD':
              tab==='diagnostics'?'DIAGNOSTIC LAYERS':'MISSION DATA LINK'}</span>
            <span>OSM BASEMAP / NO AUTOMATED ROAD ROUTING</span></div>
          <CinemaMap location={location} snapshot={snapshot} effects={effects} recenter={recenter}
            mode={tab} interactive={safety.stationaryConfirmed}/>
          {tab==='diagnostics'&&<DiagnosticPanel location={location} snapshot={snapshot} isDemo={isDemo}/>}
          {tab==='mission'&&<MissionPanel assignment={assignment} isDemo={isDemo}/>}
        </main>
        <aside className="at-cinema-command-pane">
          <div className="at-cinema-console-head"><Terminal size={17}/>
            <div><strong>COMMAND BRIDGE</strong><small>DISPLAY CONTROLS ONLY</small></div></div>
          <div className="at-cinema-voice-figure" aria-hidden="true">
            {Array.from({length:30},(_,i)=><i key={i} style={{'--i':i,
              '--wave-height':(15+(i*13%72))+'%'}}/>)}
          </div>
          <p className="at-cinema-command-caption">
            {safety.stationaryConfirmed?'Select a read-only display command below.':
              'Interactions locked until a stationary state is verified.'}</p>
          <div className="at-cinema-command-chips">
            {CINEMA_COMMANDS.filter(x=>x.id!=='exit').map(item=><button key={item.id}
              type="button" disabled={!safety.stationaryConfirmed}
              onClick={()=>execute(item.examples[0])}><ChevronRight size={13}/>{item.label}</button>)}
          </div>
          <form className="at-cinema-command-form" onSubmit={event=>{
            event.preventDefault();execute(command);}}>
            <label htmlFor="at-cinema-typed">Typed display command</label>
            <div><input ref={inputRef} id="at-cinema-typed" autoComplete="off"
              maxLength={120} value={command} onChange={event=>setCommand(event.target.value)}
              disabled={!safety.stationaryConfirmed} placeholder="show map / diagnostics / help"/>
              <button type="submit" disabled={!safety.stationaryConfirmed||!command.trim()}
                aria-label="Execute display command"><ChevronRight size={18}/></button></div>
          </form>
          <button type="button" className={'at-cinema-mic'+(voiceStatus==='listening'?' listening':'')}
            disabled={!safety.allowVoice} onClick={()=>{
              if(voiceStatus==='listening')stopSpeech();else startSpeech();
            }}>{voiceStatus==='listening'?<MicOff size={18}/>:<Mic size={18}/>}
            {voiceStatus==='listening'?'Stop listening':
              speechAvailable?'Push to talk (opt in)':'Voice unavailable / type instead'}</button>
          <div className="at-cinema-command-response" role="status">
            <AudioLines size={15}/><span>{micError||notice}</span></div>
          <p className="at-cinema-console-note"><ShieldAlert size={13}/>
            No always-on microphone. Browser speech recognition may process audio outside this app.
            Voice controls cannot navigate the truck, modify dispatch, change HOS or move money.</p>
        </aside>
      </div>
      <footer className="at-cinema-footer"><span><ShieldCheck size={14}/>
        {isDemo?'SAMPLE MODE — ALL GPS AND VEHICLE READINGS SYNTHETIC':
          'REAL MODE — ONLY AUTHORIZED GPS; VEHICLE SYSTEMS NOT CONNECTED'}</span>
        <span><VolumeX size={14}/> VISUAL FX ARE DECORATIVE · DO NOT OPERATE WHILE DRIVING</span></footer>
    </div>}
  </div>;
}
