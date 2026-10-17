import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Public OpenStreetMap tiles are for pilot-scale visualization, not a commercial
 * tile SLA. Replace the tile source with a contracted provider before scale-up.
 * Pins are rendered only from actual Supabase location rows (or labeled demo data).
 */
export default function FleetMap({ locations = [], theme = 'dark', onChoose, className = '' }) {
  const host = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const valid = locations.filter(item => Number.isFinite(Number(item.latitude)) &&
    Number.isFinite(Number(item.longitude)) &&
    Number(item.latitude) >= -90 && Number(item.latitude) <= 90 &&
    Number(item.longitude) >= -180 && Number(item.longitude) <= 180);

  useEffect(() => {
    if (!host.current || map.current) return undefined;
    const instance = L.map(host.current, { zoomControl: false, scrollWheelZoom: false, preferCanvas: true })
      .setView([38.6, -96.6], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18, minZoom: 3,
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const observer = typeof ResizeObserver !== 'undefined' ?
      new ResizeObserver(() => instance.invalidateSize({ pan: false })) : null;
    if (observer) observer.observe(host.current);
    return () => {
      observer?.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;
    if (!instance || !layer) return;
    layer.clearLayers();
    const bounds = [];
    valid.forEach(location => {
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      const lastPing = location.last_ping_at ? Date.parse(location.last_ping_at) : NaN;
      const online = Number.isFinite(lastPing) && Date.now() - lastPing < 300000;
      const icon = L.divIcon({
        className: 'at-map-pin-wrap',
        html: '<span class="at-map-pin ' + (online ? 'at-map-pin-live' : 'at-map-pin-idle') + '"><span class="at-pin-core"></span></span>',
        iconSize: [35, 35], iconAnchor: [17, 17],
      });
      const marker = L.marker([lat, lng], { icon, keyboard: true });
      const popup = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = location.unit_number || location.display_name || 'Driver location';
      const desc = document.createElement('div');
      desc.textContent = (location.status || 'Unknown status').replaceAll('_', ' ') +
        ' · ' + (online ? 'Recently reported' : 'Last update unavailable or stale');
      popup.append(heading, desc);
      marker.bindPopup(popup);
      marker.on('click', () => onChoose?.(location));
      marker.addTo(layer);
      bounds.push([lat, lng]);
    });
    if (bounds.length > 1) instance.fitBounds(bounds, { padding: [58, 58], maxZoom: 11 });
    else if (bounds.length === 1) instance.setView(bounds[0], 10);
  }, [locations, onChoose]);

  return <div className={'at-fleet-map ' + className + ' at-map-' + theme}>
    <div ref={host} className="at-fleet-map-canvas" role="application" aria-label="Interactive fleet map" />
    <div className="at-map-coordinates"><span className="at-map-crosshair">+</span> NORTH AMERICA / LIVE TELEMETRY</div>
    {valid.length === 0 && <div className="at-map-empty"><span className="at-map-radar" aria-hidden="true" />
      <strong>Waiting for fleet location data</strong>
      <span>Authorized GPS pings will appear here as vehicles report.</span></div>}
  </div>;
}
