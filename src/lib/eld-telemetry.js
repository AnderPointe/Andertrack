import {ACTIVE_STATUSES} from './operations.js';

export function mergeTelemetryTick(previous, tick, organizationId) {
  if (tick?.organization_id !== organizationId || typeof tick.truck_id !== 'string' ||
      typeof tick.latitude !== 'number' || !Number.isFinite(tick.latitude) || Math.abs(tick.latitude) > 90 ||
      typeof tick.longitude !== 'number' || !Number.isFinite(tick.longitude) || Math.abs(tick.longitude) > 180 ||
      !Number.isFinite(Date.parse(tick.updated_at)) || Date.parse(tick.updated_at) > Date.now() + 30000) return previous;
  const old = previous[tick.truck_id];
  if (old && Date.parse(old.updated_at) >= Date.parse(tick.updated_at)) return previous;
  return {...previous, [tick.truck_id]: tick};
}

// Only verified inventory + one active assignment can associate a truck tick
// with a driver. Device-supplied driver IDs never enter the existing map pipeline.
export function telemetryLocations({ticks, vehicles, assignments, organizationId, locations}) {
  const derived = vehicles.flatMap(vehicle => {
    const tick = ticks[vehicle.unit_number];
    if (!tick || tick.organization_id !== organizationId || vehicle.enabled === false) return [];
    const links = assignments.filter(a => a.vehicle_id === vehicle.id && a.driver_user_id && ACTIVE_STATUSES.has(a.status));
    const drivers = [...new Set(links.map(a => a.driver_user_id))];
    if (drivers.length !== 1) return [];
    return [{id: `eld:${vehicle.id}`, driver_id: drivers[0], unit_number: vehicle.unit_number,
      latitude: tick.latitude, longitude: tick.longitude, last_ping_at: tick.updated_at,
      speed_mph: tick.current_speed_kmh / 1.609344, source: 'eld'}];
  });
  if (!derived.length) return locations;
  // Prefer the freshest sample for each driver/unit; do not double-count trucks
  // in existing fleet lists. Untagged phone GPS matches only one derived unit.
  const seen = new Set();
  return [...locations, ...derived]
    .sort((a,b) => Date.parse(b.last_ping_at)-Date.parse(a.last_ping_at))
    .filter(point => {
      const matches = derived.filter(row => row.driver_id === point.driver_id);
      const unit = point.unit_number || (matches.length === 1 ? matches[0].unit_number : point.id);
      const key = `${point.driver_id}:${unit}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
