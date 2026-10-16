import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const licenseRank = { A: 3, B: 2, C: 1 };
const nextStatus = {
  accepted: ['at_pickup', 'Arrived at pickup'],
  at_pickup: ['picked_up', 'Confirm cargo pickup'],
  picked_up: ['in_transit', 'Start delivery route'],
};

function pretty(value) {
  return (value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * The frontend never writes assignments directly.
 * All mutations go through authenticated RPCs, with server-side org, driver,
 * vehicle, status, concurrency and audit checks.
 */
export default function AssignmentActions({
  assignment, role, currentUserId, profile, drivers, vehicles, onChanged,
}) {
  const [driverUserId, setDriverUserId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isPlanner = role === 'admin' || role === 'dispatcher';
  const isOwner = role === 'driver' && assignment?.driver_user_id === currentUserId;
  const a = assignment;

  useEffect(() => {
    setDriverUserId('');
    setVehicleId('');
    setNotice('');
    setError('');
  }, [a?.id, a?.status]);

  const eligibleVehicles = useMemo(() => (vehicles || [])
    .filter(v => v.enabled && (
      (a?.division === 'CDL' && ['A', 'B'].includes(v.required_license_class))
      || (a?.division === 'Class C' && v.required_license_class === 'C')
    )), [vehicles, a?.division]);

  const chosenVehicle = eligibleVehicles.find(v => v.id === vehicleId);
  const eligibleDrivers = useMemo(() => (drivers || []).filter(d =>
    d.license_verified && d.availability === 'available'
    && chosenVehicle && licenseRank[d.license_class] >= licenseRank[chosenVehicle.required_license_class]
  ), [drivers, chosenVehicle]);

  async function transact(name, values, confirmation) {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc(name, values);
      if (rpcError) throw rpcError;
      setNotice(confirmation);
      await onChanged?.();
    } catch (err) {
      setError(err?.message || 'Action failed. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!a) return null;

  return <section className="assignment-actions" aria-label="Assignment actions">
    <div className="sectionhead">
      <h3><ShieldCheck size={17}/> Assignment actions</h3>
      <span className="muted">Server-authorized</span>
    </div>
    {isPlanner && a.status === 'unassigned' && (
      <form className="offer-form" onSubmit={e => {
        e.preventDefault();
        if (!driverUserId || !vehicleId) return;
        transact('at_offer_assignment', {
          p_assignment_id: a.id, p_driver_user_id: driverUserId, p_vehicle_id: vehicleId,
        }, 'Offer sent. Awaiting driver acceptance.');
      }}>
        <label htmlFor="offer-vehicle">Qualified vehicle</label>
        <select id="offer-vehicle" value={vehicleId} onChange={e => { setVehicleId(e.target.value); setDriverUserId(''); }} required>
          <option value="">Select vehicle</option>
          {eligibleVehicles.map(v => <option key={v.id} value={v.id}>{v.unit_number} · {pretty(v.vehicle_type)} · Class {v.required_license_class}</option>)}
        </select>
        <label htmlFor="offer-driver">Verified, available driver</label>
        <select id="offer-driver" value={driverUserId} onChange={e => setDriverUserId(e.target.value)} required disabled={!vehicleId}>
          <option value="">Select eligible driver</option>
          {eligibleDrivers.map(d => <option key={d.user_id} value={d.user_id}>{d.display_name} · Class {d.license_class}</option>)}
        </select>
        {eligibleVehicles.length === 0 && <p className="muted">No eligible vehicle is configured for this division.</p>}
        {vehicleId && eligibleDrivers.length === 0 && <p className="muted">No verified, available driver matches this vehicle.</p>}
        <button className="primary" type="submit" disabled={busy || !vehicleId || !driverUserId}>Offer assignment <ArrowRight size={16}/></button>
        <small className="muted">The server rechecks qualifications, eligibility and conflicts. This preliminary check does not validate endorsements, insurance or HOS.</small>
      </form>
    )}
    {isOwner && a.status === 'offered' && (
      <div className="driver-decisions">
        <p className="muted">Review the load and equipment requirements before accepting.</p>
        <button className="primary" disabled={busy || !profile?.license_verified} onClick={() => transact('at_respond_assignment', { p_assignment_id: a.id, p_accept: true }, 'Assignment accepted.')}>Accept assignment <CheckCircle2 size={16}/></button>
        <button className="secondary" disabled={busy} onClick={() => transact('at_respond_assignment', { p_assignment_id: a.id, p_accept: false }, 'Assignment declined and returned to dispatch.')}>Decline offer</button>
        {!profile?.license_verified && <p className="muted">License verification is required before acceptance.</p>}
      </div>
    )}
    {isOwner && nextStatus[a.status] && (
      <button className="primary" disabled={busy || !profile?.license_verified} onClick={() => transact('at_advance_assignment', { p_assignment_id: a.id, p_next_status: nextStatus[a.status][0] }, 'Assignment status updated.')}>{nextStatus[a.status][1]} <ArrowRight size={16}/></button>
    )}
    {isOwner && a.status === 'in_transit' && <p className="muted">Delivery confirmation is locked until a proof-of-delivery workflow is available.</p>}
    {isPlanner && a.status !== 'unassigned' && <p className="muted">Status: {pretty(a.status)}. Driver controls become available after a valid offer is issued. Cancellation and reassignment require a future audited dispatcher workflow.</p>}
    {error && <p className="action-error" role="alert"><ShieldAlert size={15}/>{error}</p>}
    {notice && <p className="action-success" role="status"><CheckCircle2 size={15}/>{notice}</p>}
  </section>;
}
