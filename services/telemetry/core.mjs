export function normalizeTelemetry(input, organizationId, now = new Date()) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Expected one JSON object');
  if (typeof input.truck_id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.truck_id)) throw new Error('Invalid truck_id');
  const number = (key, min, max, fallback) => {
    const value = input[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  const lon = number('lon', -180, 180), lat = number('lat', -90, 90), alt = number('alt', -12000, 100000, 0);
  return {
    organization_id: organizationId, truck_id: input.truck_id,
    current_speed_kmh: number('speed_kmh', 0, 300), fuel_level_pct: number('fuel_pct', 0, 100),
    odometer_km: number('odometer_km', 0, 1e9), longitude: lon, latitude: lat, altitude_m: alt,
    point_wkt: `SRID=4326;POINT Z (${lon} ${lat} ${alt})`, updated_at: now.toISOString(),
  };
}

// Latest tick per truck, not an append-only array: duplicate keys in one Postgres
// upsert would otherwise fail. One in-flight flush; failures retain newer ticks.
export function createPipeline({organizationId, send, maxTrucks = 1000}) {
  const pending = new Map();
  let flushing;
  return {
    async ingest(input) {
      const tick = normalizeTelemetry(input, organizationId);
      if (!pending.has(tick.truck_id) && pending.size >= maxTrucks) throw new Error('Telemetry queue full');
      pending.set(tick.truck_id, tick);
      // Broadcast failure does not discard the durable-state retry buffer.
      await send('/realtime/v1/api/broadcast', {messages: [{
        topic: `telemetry:${organizationId}`, event: 'telemetry', private: true, payload: tick,
      }]});
      return tick;
    },
    flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        const snapshot = [...pending.values()].slice(0, 50);
        if (!snapshot.length) return;
        await send('/rest/v1/rpc/at_ingest_vehicle_telemetry', {p_organization_id: organizationId, p_ticks: snapshot});
        for (const tick of snapshot) if (pending.get(tick.truck_id) === tick) pending.delete(tick.truck_id);
      })().finally(() => { flushing = null; });
      return flushing;
    },
    get size() { return pending.size; },
  };
}
