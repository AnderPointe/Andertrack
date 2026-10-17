import React,{useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { validGpsPosition } from '../../lib/operations.js';

/**
 * Manual route replay. No streaming marker animations or auto-recorded
 * geofence incidents. GPS positions come from authorized rows only.
 */
export default function FleetReplayMap({
  points=[],selectedIndex=0,unit=null,fence=null,onChooseCenter=()=>{},scopeKey='',
}) {
  const hostRef=useRef(null);
  const mapRef=useRef(null);
  const overlayRef=useRef(null);
  const centerRef=useRef(onChooseCenter);
  centerRef.current=onChooseCenter;
  const fitRef=useRef(false);

  useEffect(()=>{
    if(!hostRef.current || mapRef.current)return undefined;
    const map=L.map(hostRef.current,{zoomControl:false,scrollWheelZoom:false,preferCanvas:true})
      .setView([38.6,-96.6],4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:18,minZoom:3,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({position:'bottomright'}).addTo(map);
    const group=L.featureGroup().addTo(map);
    mapRef.current=map;
    overlayRef.current=group;
    map.on('click',event=>centerRef.current?.({latitude:event.latlng.lat,longitude:event.latlng.lng}));
    const observer=typeof ResizeObserver!=='undefined'?
      new ResizeObserver(()=>map.invalidateSize({pan:false})):null;
    observer?.observe(hostRef.current);
    return ()=>{
      observer?.disconnect();
      group.clearLayers();
      map.remove();
      mapRef.current=null;
      overlayRef.current=null;
      fitRef.current=false;
    };
  },[scopeKey]);

  useEffect(()=>{
    const map=mapRef.current, group=overlayRef.current;
    if(!map||!group)return;
    group.clearLayers();
    const valid=points.filter(validGpsPosition);
    const bounds=[];
    if(valid.length){
      const coords=valid.map(p=>[Number(p.latitude),Number(p.longitude)]);
      L.polyline(coords,{color:'#32d2c1',weight:4,opacity:.84,smoothFactor:0}).addTo(group);
      // Numbered endpoints make it clear this is a recorded trace, not routing.
      for(const [i,p] of [[0,valid[0]],[valid.length-1,valid.at(-1)]]){
        const endpoint=L.circleMarker([p.latitude,p.longitude],{
          radius:7,color:'#fff',weight:2,fillColor:i===0?'#32d2c1':'#ff981b',fillOpacity:1,
        }).addTo(group);
        const label=document.createElement('span');
        label.textContent=i===0?'First recorded point':'Last recorded point';
        endpoint.bindTooltip(label);
      }
      const clamped=Math.max(0,Math.min(selectedIndex,valid.length-1));
      const position=valid[clamped];
      L.circleMarker([position.latitude,position.longitude],{
        radius:12,color:'#fff',weight:3,fillColor:'#ff981b',fillOpacity:1,
      }).bindPopup(()=>{
        const popup=document.createElement('div');
        const label=document.createElement('strong');
        label.textContent=position.unit_number||unit?.unit_number||'Selected vehicle';
        const stamp=document.createElement('div');
        stamp.textContent='Recorded '+new Date(position.recorded_at).toLocaleString();
        popup.append(label,stamp);
        return popup;
      }).addTo(group);
      bounds.push(...coords);
    }else if(validGpsPosition(unit)){
      const marker=L.circleMarker([unit.latitude,unit.longitude],{
        radius:9,color:'#fff',weight:2,fillColor:'#ff981b',fillOpacity:.94,
      }).addTo(group);
      const tooltip=document.createElement('span');
      tooltip.textContent=unit.unit_number||'Current reported location';
      marker.bindTooltip(tooltip);
      bounds.push([Number(unit.latitude),Number(unit.longitude)]);
    }
    if(fence&&validGpsPosition(fence)&&Number(fence.radiusMiles)>0){
      L.circle([Number(fence.latitude),Number(fence.longitude)],{
        radius:Number(fence.radiusMiles)*1609.344,color:'#ff981b',weight:2,
        fillColor:'#ff981b',fillOpacity:.08,dashArray:'7 5',
      }).addTo(group);
      bounds.push([Number(fence.latitude),Number(fence.longitude)]);
    }
    // Do not override dispatcher pan/zoom when scrubbing the replay.
    if(!fitRef.current&&bounds.length){
      if(bounds.length===1)map.setView(bounds[0],10);
      else map.fitBounds(bounds,{padding:[46,46],maxZoom:12});
      fitRef.current=true;
    }
  },[points,selectedIndex,unit,fence]);

  return <div className="at-replay-map" aria-label="Recorded GPS route replay">
    <div ref={hostRef} className="at-replay-map-canvas" role="region" aria-label="Recorded GPS positions with interactive monitoring circle"/>
    <div className="at-replay-map-label">GPS TRACE · STRAIGHT SEGMENTS · CLICK TO SET MONITORING CENTER</div>
    {(!points.length&&!validGpsPosition(unit))&&<div className="at-replay-empty">
      <strong>No authorized GPS coordinates</strong>
      <span>Choose a vehicle when a real GPS feed is connected, or view the sample demo.</span>
    </div>}
  </div>;
}
