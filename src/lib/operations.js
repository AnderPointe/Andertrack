/** Pure, UI-independent operational guards. Values are from RLS-scoped data only. */
export const ACTIVE_STATUSES = new Set(['offered','assigned','accepted','at_pickup','picked_up','in_transit']);

export function validGpsPosition(point) {
  if (point?.latitude == null || point?.longitude == null ||
      point.latitude === '' || point.longitude === '') return false;
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Reject future timestamps, stale pings and unparsable dates. */
export function freshGpsPosition(point, now = Date.now(), maxAgeMs = 300_000) {
  if (!validGpsPosition(point) || !point?.last_ping_at) return false;
  const updated = Date.parse(point.last_ping_at);
  const age = now - updated;
  return Number.isFinite(updated) && age >= 0 && age <= maxAgeMs;
}

export function visibleShipments(assignments, filter = 'all', query = '') {
  const needle = String(query || '').trim().toLowerCase();
  return (assignments || []).filter(assignment => {
    const status = assignment.status;
    const matches = filter === 'all' ||
      (filter === 'active' && ACTIVE_STATUSES.has(status)) ||
      (filter === 'pending' && ['unassigned','offered'].includes(status)) ||
      status === filter;
    if (!matches) return false;
    return [
      assignment.reference, assignment.customer_name, assignment.pickup_address,
      assignment.dropoff_address, assignment.commodity, assignment.division,
    ].join(' ').toLowerCase().includes(needle);
  });
}

export function selectedVisibleShipment(assignments, requestedId) {
  return assignments.find(item => item.id === requestedId) || assignments[0] || null;
}
