import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinned, ShieldAlert } from 'lucide-react';
import { validGpsPosition, freshGpsPosition } from '../../lib/operations.js';

// Keep all marker styling values hardcoded. Never interpolate untrusted GPS labels into HTML.
const STATUS_COLORS = {
  available: '#32d2c1',
  assigned: '#69b5ff',
  accepted: '#69b5ff',
  at_pickup: '#ff981b',
  picked_up: '#ff981b',
  in_transit: '#ff981b',
  loaded: '#ffba61',
  break: '#ff981b',
  offline: '#8292a5',
  alert: '#ff7979',
};
const DEFAULT_COLOR = '#32d2c1';

/**
 * Compatible with Phase 4 pilot usage (error/loading) and the current
 * Command Center usage (theme/onChoose/className).
 * Read-only map: GPS data must already be authorized by Supabase RLS.
 */
export default function FleetMap({
  locations = [],
  theme = 'dark',
  onChoose,
  className = '',
  error = '',
  loading = false,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const onChooseRef = useRef(onChoose);
  onChooseRef.current = onChoose;

  const points = useMemo(
    () => (Array.isArray(locations) ? locations : []).filter(validGpsPosition),
    [locations],
  );
  const stale = points.filter(point => !freshGpsPosition(point)).length;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return undefined;

    const map = L.map(hostRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      preferCanvas: true,
    }).setView([38.6, -96.6], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 3,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layer = L.featureGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : null;
    observer?.observe(hostRef.current);

    return () => {
      observer?.disconnect();
      layer.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return undefined;

    layer.clearLayers();

    points.forEach(point => {
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);
      const isFresh = freshGpsPosition(point);
      const color = STATUS_COLORS[point.status] || DEFAULT_COLOR;
      const marker = L.divIcon({
        className: 'at-map-pin-wrap',
        html:
          '<span class="at-map-pin ' +
          (isFresh ? 'at-map-pin-live' : 'at-map-pin-idle') +
          '" style="--at-marker-color:' + color +
          '"><span class="at-pin-core"></span></span>',
        iconSize: [35, 35],
        iconAnchor: [17, 17],
      });

      const pin = L.marker([lat, lng], { icon: marker, keyboard: true });
      const popup = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = point.unit_number || point.vehicle_type || point.display_name || 'Vehicle';
      const details = document.createElement('div');
      const lastPing = point.last_ping_at ? new Date(point.last_ping_at) : null;
      const pingText = lastPing && !Number.isNaN(lastPing.getTime())
        ? lastPing.toLocaleString()
        : 'Unknown';
      details.textContent =
        String(point.status || 'unknown').replaceAll('_', ' ') +
        ' · Last GPS update: ' + pingText +
        (isFresh ? ' · Recently reported' : ' · GPS stale / unavailable');
      popup.append(heading, details);
      pin.bindPopup(popup);
      pin.bindTooltip(popup.textContent);
      pin.on('click', () => onChooseRef.current?.(point));
      pin.addTo(layer);
    });

    // Auto-fit once; keep the dispatcher’s chosen zoom and position on each GPS update.
    if (!fittedRef.current && points.length) {
      if (points.length === 1) {
        map.setView([Number(points[0].latitude), Number(points[0].longitude)], 10);
      } else {
        map.fitBounds(layer.getBounds().pad(0.2), { maxZoom: 11 });
      }
      fittedRef.current = true;
    }
    return undefined;
  }, [points]);

  return (
    <section className={'at-fleet-map at-map-' + theme + ' ' + className}
      aria-label="Authorized fleet locations">
      <div ref={hostRef} className="at-fleet-map-canvas"
        role="region" aria-label="Interactive fleet map" />

      <div className="at-map-coordinates">
        <span className="at-map-crosshair">+</span> NORTH AMERICA / LIVE TELEMETRY
      </div>

      <div className="at-map-summary" aria-live="polite">
        <MapPinned size={15} aria-hidden="true" />
        <span>{points.length} GPS {points.length === 1 ? 'position' : 'positions'}</span>
        <span className="at-map-summary-divider">·</span>
        <span>{stale} stale</span>
        {loading && <span className="at-map-summary-loading">Refreshing…</span>}
      </div>

      {error && <div className="at-map-error" role="alert">
        <ShieldAlert size={16} aria-hidden="true" />
        <span>{error}</span>
      </div>}

      {points.length === 0 && (
        <div className="at-map-empty">
          <span className="at-map-radar" aria-hidden="true" />
          <strong>Waiting for fleet location data</strong>
          <span>Authorized GPS pings will appear as vehicles report.</span>
        </div>
      )}
    </section>
  );
}
