import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Check,RotateCcw,Truck} from 'lucide-react';
import {VEHICLE_FORMS,VEHICLE_COLORS,VEHICLE_MODEL_PRESETS,previewPresetForVehicle,vehicleForm,vehicleDisplay} from '../../lib/vehicle-3d.js';
import './vehicle-3d.css';

// Original parametric vehicle forms. Generic representations, never claimed to be
// licensed manufacturer GLB / exact VIN digital twins. No assets fetched.
function buildVehicle(root,type,paint) {
  const paints=[];
  const shell=new THREE.MeshStandardMaterial({color:paint,metalness:.32,roughness:.31});
  const steel=new THREE.MeshStandardMaterial({color:'#a2b3bd',metalness:.85,roughness:.2});
  const chrome=new THREE.MeshStandardMaterial({color:'#d5e3e6',metalness:.9,roughness:.16});
  const tire=new THREE.MeshStandardMaterial({color:'#111820',roughness:.88});
  const dark=new THREE.MeshStandardMaterial({color:'#1e2a36',roughness:.55,metalness:.15});
  const glass=new THREE.MeshStandardMaterial({color:'#457782',metalness:.65,roughness:.13,transparent:true,opacity:.87});
  const light=new THREE.MeshStandardMaterial({color:'#e2f7e9',emissive:'#86c6cb',emissiveIntensity:.26});
  const red=new THREE.MeshStandardMaterial({color:'#c32828',emissive:'#871515',emissiveIntensity:.19});
  const cargo=new THREE.MeshStandardMaterial({color:'#dde5e0',roughness:.51,metalness:.1});
  const lamps=[light,red,steel,chrome,shell,glass,dark,tire,cargo];paints.push(...lamps);
  const piece=(parent,w,h,d,x,y,z,mat,bevel=0)=>{
    const geo=new THREE.BoxGeometry(w,h,d);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const wheel=(x,z,r=.55)=>{
    const geo=new THREE.CylinderGeometry(r,r,.24,28);
    const mesh=new THREE.Mesh(geo,tire);mesh.rotation.z=Math.PI/2;
    mesh.position.set(x,r,z);mesh.castShadow=true;root.add(mesh);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(r*.48,r*.48,.25,24),chrome);
    rim.rotation.z=Math.PI/2;rim.position.set(x,r,z);root.add(rim);
  };
  const body=(h=1.5,l=3.3)=>piece(root,2.25,h,l,0,1.02+h/2,-l*.19,shell);
  const glassFront=(z,cy=2.3,w=2)=>piece(root,w,.88,.056,0,cy,z,glass);
  const addLights=(frontZ,rearZ,frontY=1.15)=>{
    for(const x of [-.82,.82]){
      piece(root,.38,.25,.10,x,frontY,frontZ,light);
      piece(root,.40,.25,.10,x,frontY,rearZ,red);
    }
  };
  if(type==='tractor'||type==='hotshot') {
    if(type==='tractor'){
      piece(root,2.4,.5,6.4,0,.90,0,dark);
      piece(root,2.40,2.18,2.25,0,2.26,1.76,shell);
      piece(root,2.25,.98,1.32,0,1.65,3.58,shell);
      const window=glassFront(2.95,2.55,2.05);
      window.rotation.x=-.22;
      for(const x of [-1.1,1.1])piece(root,.045,.57,.84,x,2.67,1.83,glass);
      piece(root,1.28,1.14,.08,0,2.48,-.11,glass);
      for(const z of [2.12,-1.1,-2.32])for(const x of [-1.18,1.18])wheel(x,z,.54);
      piece(root,2.56,.31,.42,0,.77,4.19,steel);
      for(const x of [-.9,-.46,0,.46,.9])piece(root,.025,.54,.055,x,1.63,4.25,chrome);
      piece(root,1.6,.35,.10,0,1.55,4.28,dark);
      piece(root,2.35,.10,.75,0,1.05,-2.76,dark);
      piece(root,1.45,.12,1.05,0,1.12,-2.08,steel);
      for(const x of [-1.06,1.06])piece(root,.11,2.20,.11,x,2.10,.29,chrome);
      addLights(4.2,-3.25,2.02);
    } else {
      piece(root,2.12,.44,5.9,0,.95,-.45,dark);
      piece(root,2.07,1.35,1.95,0,1.93,1.86,shell);
      piece(root,2.08,.9,1.18,0,1.59,3.37,shell);
      glassFront(2.87,2.08,1.88);
      for(const x of [-1.08,1.08])piece(root,.045,.65,.64,x,2.22,1.92,glass);
      piece(root,2.14,.10,.17,0,1.11,-3.55,chrome);
      for(const z of [2.00,-.5,-2.92])for(const x of [-1.13,1.13])wheel(x,z,.45);
      piece(root,2.30,.18,1.03,0,.95,-1.8,steel);
      for(const x of [-.9,.9])piece(root,.11,.19,3.3,x,1.18,-2.15,chrome);
      addLights(4.02,-3.54,1.4);
    }
  } else if(type==='box_truck'){
    piece(root,2.28,.44,6.45,0,.91,0,dark);
    piece(root,2.38,2.20,3.73,0,2.37,-1.18,cargo);
    piece(root,2.24,1.72,1.85,0,2.02,2.40,shell);
    piece(root,2.18,.59,.83,0,1.47,3.70,shell);
    const front=glassFront(3.41,2.26,1.96);
    front.rotation.x=-.17;
    for(const x of [-1.18,1.18])piece(root,.045,.58,.76,x,2.15,2.34,glass);
    for(const z of [2.28,-1.9,-2.76])for(const x of [-1.18,1.18])wheel(x,z,.48);
    for(let i=0;i<6;i++)piece(root,.025,1.75,.05,-1.20,2.3,-2.77+i*.51,steel);
    piece(root,2.36,.22,.2,0,1.40,-3.09,steel);
    piece(root,2.25,.16,.28,0,.84,4.00,chrome);
    addLights(3.96,-3.1,1.55);
  } else if(type==='cargo_van'){
    piece(root,2.19,.48,5.60,0,.77,0,dark);
    piece(root,2.18,2.12,4.00,0,2.03,-.48,shell);
    piece(root,2.06,1.70,1.55,0,1.90,2.07,shell);
    piece(root,2.08,.78,.79,0,1.38,3.13,shell);
    const pane=glassFront(2.84,2.16,1.9);pane.rotation.x=-.16;
    for(const x of [-1.12,1.12])piece(root,.045,.68,.90,x,2.32,1.75,glass);
    for(const x of [-1.13,1.13])wheel(x,2.12,.44),wheel(x,-1.95,.44);
    piece(root,.025,1.32,.09,-1.12,2.0,-.42,steel);
    piece(root,.028,1.35,.05,1.12,2.03,.65,steel);
    piece(root,1.87,.10,.13,0,.88,3.58,chrome);
    addLights(3.56,-2.57,1.45);
  } else {
    piece(root,2.23,.5,5.10,0,.80,0,dark);
    piece(root,2.2,1.32,2.2,0,1.79,1.08,shell);
    piece(root,2.07,.75,1.32,0,1.54,2.86,shell);
    piece(root,2.2,.77,1.60,0,1.29,-1.67,shell);
    glassFront(2.28,2.04,1.90);
    for(const x of [-1.12,1.12])piece(root,.04,.55,.62,x,2.14,1.29,glass);
    piece(root,1.95,.12,1.10,0,2.47,.47,dark);
    for(const z of [1.35,-1.59])for(const x of [-1.14,1.14])wheel(x,z,.46);
    piece(root,2.25,.12,.24,0,.88,3.55,chrome);
    addLights(3.53,-2.48,1.43);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(5,64),
    new THREE.MeshBasicMaterial({color:'#142931',transparent:true,opacity:.14,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.005;shadow.scale.set(1.2,.55,1);root.add(shadow);
  return ()=>{root.traverse(object=>{if(object.isMesh)object.geometry.dispose();});paints.forEach(m=>m.dispose());shadow.material.dispose();};
}

function SceneCanvas({form,color,rotating,view,zoom,onError=()=>{}}){
  const container=useRef(null);
  useEffect(()=>{
    const host=container.current;if(!host)return undefined;
    const w=Math.max(220,host.clientWidth),h=Math.max(160,host.clientHeight);
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});}
    catch(err){onError('3D unavailable on this device. Vehicle details remain accessible.');return undefined;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
    renderer.setSize(w,h);
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.6;
    host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(37,w/h,.1,200);
    const root=new THREE.Group();scene.add(root);
    const disposeVehicle=buildVehicle(root,form,color);
    scene.add(new THREE.AmbientLight('#ffffff',2.0));
    const key=new THREE.DirectionalLight('#fff2dc',4.5);key.position.set(4,9,7);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
    const rim=new THREE.DirectionalLight('#b3dfff',3);rim.position.set(-6,4,-6);scene.add(rim);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),
      new THREE.ShadowMaterial({color:'#111a1d',opacity:.13}));
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    const grid=new THREE.GridHelper(18,18,'#9cbdaf','#c7d5cb');grid.position.y=.014;
    grid.material.transparent=true;grid.material.opacity=.17;scene.add(grid);
    const cameraDistance=11.7/zoom;
    let azimuth=view==='front'?0:view==='side'?Math.PI/2:.8;
    let elevation=.27;
    const render=()=>{camera.position.set(Math.sin(azimuth)*cameraDistance,Math.sin(elevation)*cameraDistance+1.3,
      Math.cos(azimuth)*cameraDistance);camera.lookAt(0,1.53,0);renderer.render(scene,camera);};
    render();
    let frame=0;let active=true;
    const animate=()=>{if(!active)return;azimuth+=.006;render();frame=requestAnimationFrame(animate);};
    if(rotating)frame=requestAnimationFrame(animate);
    let last=null;
    const down=e=>{last={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);};
    const move=e=>{if(!last)return;azimuth+=(e.clientX-last.x)*.009;
      elevation=Math.min(.7,Math.max(-.11,elevation+(e.clientY-last.y)*.006));
      last={x:e.clientX,y:e.clientY};render();};
    const up=()=>{last=null;};
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);
    canvas.addEventListener('pointercancel',up);
    const resize=()=>{const x=Math.max(200,host.clientWidth),y=Math.max(160,host.clientHeight);
      camera.aspect=x/y;camera.updateProjectionMatrix();renderer.setSize(x,y);render();};
    const obs=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);
    obs?.observe(host);
    return ()=>{
      active=false;cancelAnimationFrame(frame);obs?.disconnect();
      canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);
      disposeVehicle();ground.geometry.dispose();ground.material.dispose();
      grid.geometry.dispose();grid.material.dispose();
      renderer.dispose();renderer.forceContextLoss();
      if(canvas.parentNode===host)host.removeChild(canvas);
    };
  },[form,color,rotating,view,zoom]);
  return <div ref={container} className="at-v3d-canvas" role="img"
    aria-label={'Interactive 3D generic '+form.replaceAll('_',' ')+' vehicle. Drag to rotate.'}
    title="Drag the model to rotate. This is an illustrative generic vehicle, not an OEM model."/>;
}
export default function Vehicle3D({
  vehicle=null,compact=false,allowSelection=true,isDemo=false,
  title='My vehicle · 3D showroom',
}) {
  const display=vehicleDisplay(vehicle);
  const [form,setForm]=useState(()=>display.form);
  const [preset,setPreset]=useState(()=>previewPresetForVehicle(vehicle));
  const [reducedMotion,setReducedMotion]=useState(false);
  const [color,setColor]=useState('arctic');
  const [view,setView]=useState('three-quarter');
  const [zoom,setZoom]=useState(1);
  const [rotate,setRotate]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setForm(vehicleForm(vehicle?.vehicle_type));setPreset(previewPresetForVehicle(vehicle));setError('');},[vehicle?.id,vehicle?.vehicle_type,vehicle?.make,vehicle?.model]);
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!media)return undefined;
    const update=()=>{setReducedMotion(media.matches);if(media.matches)setRotate(false);};
    update();media.addEventListener?.('change',update);
    return ()=>media.removeEventListener?.('change',update);
  },[]);
  const choice=VEHICLE_FORMS.find(x=>x.id===form)||VEHICLE_FORMS[0];
  const chosenPreset=VEHICLE_MODEL_PRESETS.find(x=>x.id===preset)||null;
  return <section className={'at-v3d '+(compact?'compact':'')}>
    <div className="at-v3d-heading"><div><span>FLEET VISUALIZATION / INTERACTIVE 3D</span>
      <h3><Truck size={19}/>{title}</h3></div><span className="at-v3d-chip">{isDemo?'DEMO SHOWROOM':'GENERIC 3D MODEL'}</span></div>
    <div className="at-v3d-stage">
      {!error?<SceneCanvas form={form} color={VEHICLE_COLORS.find(c=>c.id===color)?.hex||'#dee9e8'}
        rotating={rotate&&!reducedMotion} view={view} zoom={zoom} onError={setError}/>:
        <div className="at-v3d-fallback"><Truck size={47}/><span>{error}</span></div>}
      <div className="at-v3d-stage-label"><strong>{chosenPreset?chosenPreset.make+' '+chosenPreset.model:choice.label}</strong><span>{chosenPreset?'Generic '+choice.label+' silhouette (not OEM CAD)':choice.subtitle}</span></div>
      <div className="at-v3d-camera"><button disabled={reducedMotion} onClick={()=>setRotate(r=>!r)} aria-label={rotate?'Pause rotation':'Rotate automatically'}>
        <RotateCwIcon spinning={rotate}/>{rotate?'Pause':'Rotate'}</button>
        <button onClick={()=>setView('three-quarter')}>3/4</button>
        <button onClick={()=>setView('front')}>Front</button>
        <button onClick={()=>setView('side')}>Side</button></div>
    </div>
    <div className="at-v3d-identity">
      <div><span>Assigned equipment</span><strong>{display.unit}</strong></div>
      <div><span>Recorded manufacturer / model</span><strong>{display.hasMakeModel?display.title:'Not recorded'}</strong></div>
    </div>
    <div className="at-v3d-bottom">
      {allowSelection&&<label>Preview vehicle body
        <select value={form} onChange={e=>{setForm(e.target.value);setPreset('');}}>
          {VEHICLE_FORMS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>}
      {allowSelection&&<label>Make / model concept preview
        <select aria-label="Select illustrative make and model" value={preset} onChange={e=>{
          const id=e.target.value;setPreset(id);
          const match=VEHICLE_MODEL_PRESETS.find(x=>x.id===id);
          if(match)setForm(match.form);
        }}>
          <option value="">Generic {choice.label}</option>
          {VEHICLE_MODEL_PRESETS.map(x=><option key={x.id} value={x.id}>{x.make} {x.model}</option>)}
        </select></label>}
      <label>Paint preview <span className="at-v3d-swatches">
        {VEHICLE_COLORS.map(c=><button key={c.id} type="button" title={c.name}
          aria-label={'Use '+c.name} aria-pressed={c.id===color} onClick={()=>setColor(c.id)}
          className={c.id===color?'picked':''} style={{background:c.hex}}>{color===c.id&&<Check size={12}/>}</button>)}
      </span></label>
      <label>Zoom <input type="range" min=".7" max="1.45" step=".05" value={zoom}
        onChange={e=>setZoom(Number(e.target.value))} aria-label="Zoom 3D vehicle"/></label>
    </div>
    <p className="at-v3d-disclaimer">3D visuals are original generic silhouettes, not exact manufacturer digital twins.
      Rotation, paint, and model choice change this preview only, never fleet inventory or dispatch assignments.</p>
  </section>;
}
function RotateCwIcon({spinning}){return <RotateCcw size={14} className={spinning?'at-v3d-spinning':''}/>;}
