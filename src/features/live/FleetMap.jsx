import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinned, ShieldAlert } from 'lucide-react';

const STATUS_COLORS = {
  available: '#49d6b4', assigned: '#67bcff', loaded: '#e7c46c',
  break: '#ffa865', offline: '#8292a5', alert: '#ff7979',
};

function validPoint(item) {
  const lat = Number(item.latitude);
  const lon = Number(item.longitude);
  return item.latitude != null && item.longitude != null &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function safeLabel(item) {
  const name = item.unit_number || item.vehicle_type || 'Vehicle';
  const time = item.last_ping_at ? new Date(item.last_ping_at).toLocaleString() : 'Unknown';
  return `${name} · ${item.status || 'unknown'} · Last GPS update: ${time}`;
}

export default function FleetMap({ locations = [], error = '', loading = false }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef(null);
  const fittedRef = useRef(false);
  const points = useMemo(() => locations.filter(validPoint), [locations]);
  const stale = points.filter(p => !p.last_ping_at || Date.now() - Date.parse(p.last_ping_at) > 5 * 60 * 1000).length;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = L.map(hostRef.current, { zoomControl: true }).setView([39, -98], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const overlays = L.featureGroup().addTo(map);
    mapRef.current = map;
    overlaysRef.current = overlays;
    return () => {
      overlays.clearLayers();
      map.remove();
      mapRef.current = null;
      overlaysRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const overlays = overlaysRef.current;
    const map = mapRef.current;
    if (!overlays || !map) return;
    overlays.clearLayers();
    for (const point of points) {
      const color = STATUS_COLORS[point.status] || '#75c6e3';
      const marker = L.circleMarker([Number(point.latitude), Number(point.longitude)], {
        radius: 9, weight: 2, color: '#ffffff', fillColor: color, fillOpacity: .9,
      });
      const tooltip = document.createElement('span');
      tooltip.textContent = safeLabel(point);
      marker.bindTooltip(tooltip);
      marker.addTo(overlays);
    }
    if (!fittedRef.current && points.length) {
      fittedRef.current = true;
      if (points.length === 1) map.setView([Number(points[0].latitude), Number(points[0].longitude)], 10);
      else map.fitBounds(overlays.getBounds().pad(0.2), { maxZoom: 11 });
    }
  }, [points]);

  return <section className="panel fleet-panel">
    <div className="sectionhead"><h2><MapPinned size={18}/> Fleet location overview</h2><span className="pill info">{points.length} GPS markers</span></div>
    <div className="fleet-summary">
      <span>{points.length} valid locations</span>
      <span>{stale} stale (over 5 minutes)</span>
      <span>{loading ? 'Refreshing…' : '30-second fallback refresh'}</span>
    </div>
    {error && <p className="action-error" role="alert"><ShieldAlert size={15}/>{error}</p>}
    {points.length === 0 && <p className="muted">No authorized GPS positions are available. Existing tracking tables require approved RLS access policies and matching organization identifiers before data appears here.</p>}
    <div ref={hostRef} className="fleet-map" aria-label="Read-only live vehicle locations" role="region"/>
    <p className="map-disclaimer">Read-only overview using OpenStreetMap tiles. Not turn-by-turn navigation; GPS can be delayed. Use a production tile provider before public launch.</p>
  </section>;
}
