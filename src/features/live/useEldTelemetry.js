import {useEffect, useState} from 'react';
import {mergeTelemetryTick} from '../../lib/eld-telemetry.js';

export default function useEldTelemetry(client, organizationId, userId, isPlanner, token) {
  const [state, setState] = useState({scope: '', ticks: {}});
  const scope = `${userId}:${organizationId}`;
  useEffect(() => {
    if (!client || !organizationId || !userId || !isPlanner || import.meta.env.VITE_ELD_TELEMETRY_ENABLED !== 'true') return;
    let active = true;
    setState({scope, ticks: {}});
    const receive = tick => {
      if (active) setState(old => ({scope, ticks: mergeTelemetryTick(old.scope === scope ? old.ticks : {}, tick, organizationId)}));
    };
    const hydrate = async () => {
      const {data, error} = await client.from('at_vehicle_telemetry')
        .select('organization_id,truck_id,current_speed_kmh,fuel_level_pct,odometer_km,latitude,longitude,altitude_m,updated_at')
        .eq('organization_id', organizationId).order('updated_at', {ascending: false}).limit(1000);
      if (!error) for (const tick of data || []) receive(tick);
    };
    let channel;
    // Refresh JWT before private-channel authorization; recreate on token refresh.
    client.realtime.setAuth(token).then(() => {
      if (!active) return;
      channel = client.channel(`telemetry:${organizationId}`, {config: {private: true}})
        .on('broadcast', {event: 'telemetry'}, ({payload}) => receive(payload))
        .subscribe(status => { if (status === 'SUBSCRIBED') hydrate().catch(() => {}); });
    }).catch(() => {});
    const interval = setInterval(() => hydrate().catch(() => {}), 30000);
    return () => { active = false; clearInterval(interval); if (channel) client.removeChannel(channel); };
  }, [client, organizationId, userId, isPlanner, token, scope]);
  return isPlanner && state.scope === scope ? state.ticks : {};
}
