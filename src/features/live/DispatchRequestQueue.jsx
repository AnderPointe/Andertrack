import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, ShieldCheck, ShieldAlert, Truck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const licenseRank = { A: 3, B: 2, C: 1 };

export default function DispatchRequestQueue({
  organizationId, role, currentUserId, profile, requests, drivers, assignments, vehicles, onChanged,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const isPlanner = role === 'admin' || role === 'dispatcher';
  const ordered = useMemo(() => [...(requests || [])].sort(
    (a, b) => Number(a.queue_number) - Number(b.queue_number),
  ), [requests]);
  const mine = ordered.find(r => r.driver_user_id === currentUserId);
  const head = ordered[0];
  const firstDriver = (drivers || []).find(d => d.user_id === head?.driver_user_id);
  const availableAssignments = (assignments || []).filter(a =>
    a.status === 'unassigned' && !a.driver_user_id);
  const selectedAssignment = availableAssignments.find(a => a.id === assignmentId);
  const eligibleVehicles = (vehicles || []).filter(v => {
    if (!v.enabled || !selectedAssignment || !firstDriver?.license_verified) return false;
    if (selectedAssignment.division === 'CDL' && !['A', 'B'].includes(v.required_license_class)) return false;
    if (selectedAssignment.division === 'Class C' && v.required_license_class !== 'C') return false;
    return licenseRank[firstDriver.license_class] >= licenseRank[v.required_license_class];
  });

  async function act(rpc, args, success) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc(rpc, args);
      if (rpcError) throw rpcError;
      setMessage(success);
      setAssignmentId('');
      setVehicleId('');
      await onChanged?.();
    } catch (err) {
      setError(err?.message || 'Request failed. Refresh and retry.');
    } finally {
      setBusy(false);
    }
  }

  if (!organizationId || !role) return null;

  return <section className="panel fifo-panel" aria-label="Live Request Queue">
    <div className="sectionhead">
      <h2><Clock size={18}/> Live Request Queue</h2>
      <span className="pill info">{isPlanner ? `${ordered.length} waiting` : (mine ? 'You are waiting' : 'Not queued')}</span>
    </div>
    {isPlanner ? <>
      <p className="muted">Requests are processed in server FIFO order. The oldest request is always first.</p>
      {ordered.length === 0 ? <p className="muted">No drivers have requested an assignment.</p> :
        <div className="fifo-list">{ordered.map((r, i) => {
          const driver = (drivers || []).find(d => d.user_id === r.driver_user_id);
          return <div className={'fifo-row ' + (i === 0 ? 'fifo-next' : '')} key={r.id}>
            <strong>#{i + 1}</strong>
            <div><b>{driver?.display_name || 'Driver ' + r.driver_user_id.slice(0, 8)}</b>
              <small>Class {driver?.license_class || '—'} · {driver?.availability || 'unknown'} · Requested {new Date(r.requested_at).toLocaleTimeString()}</small></div>
            {i === 0 && <span className="pill success">Next</span>}
          </div>;
        })}</div>}
      {head && <form className="fifo-form" onSubmit={event => {
        event.preventDefault();
        if (!assignmentId || !vehicleId) return;
        act('at_claim_next_dispatch', {
          p_organization_id: organizationId, p_assignment_id: assignmentId, p_vehicle_id: vehicleId,
        }, 'Oldest request matched to an offer. Awaiting driver acceptance.');
      }}>
        <label htmlFor="fifo-assignment">Available load for the next driver</label>
        <select id="fifo-assignment" value={assignmentId} onChange={e => { setAssignmentId(e.target.value); setVehicleId(''); }} required>
          <option value="">Select unassigned load</option>
          {availableAssignments.map(a => <option key={a.id} value={a.id}>{a.reference} · {a.division} · {a.customer_name}</option>)}
        </select>
        <label htmlFor="fifo-vehicle">Eligible equipment</label>
        <select id="fifo-vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value)} disabled={!assignmentId} required>
          <option value="">Select equipment</option>
          {eligibleVehicles.map(v => <option key={v.id} value={v.id}>{v.unit_number} · Class {v.required_license_class}</option>)}
        </select>
        <button type="submit" className="primary" disabled={busy || !assignmentId || !vehicleId}>
          <ArrowRight size={16}/> Offer to next driver
        </button>
        {assignmentId && eligibleVehicles.length === 0 && <small className="muted">No matching, enabled equipment. The server will not skip this request.</small>}
      </form>}
    </> : <>
      <p className="muted">Request your next assignment when you are available. Requests are queued in the order received by the server.</p>
      {mine ? <div className="fifo-current"><Truck size={20}/><div><strong>Waiting for dispatch</strong><small>Request #{mine.queue_number} · {new Date(mine.requested_at).toLocaleString()}</small></div></div> :
        <p className="muted">Status: {profile?.availability || 'offline'} · {profile?.license_verified ? 'License verified' : 'License verification required'}</p>}
      {mine ?
        <button type="button" className="secondary" disabled={busy} onClick={() => act('at_cancel_dispatch', { p_organization_id: organizationId }, 'Your queue request was cancelled.')}>
          <XCircle size={16}/> Cancel request
        </button> :
        <button type="button" className="primary" disabled={busy || !profile?.license_verified || profile?.availability !== 'available'} onClick={() => act('at_request_dispatch', { p_organization_id: organizationId }, 'Request received. You are in the dispatch queue.')}>
          <Truck size={16}/> Request Assignment
        </button>}
      {!mine && (!profile?.license_verified || profile?.availability !== 'available') && <small className="muted">Only verified, available drivers can join the queue.</small>}
    </>}
    {error && <div className="action-error fifo-message" role="alert"><ShieldAlert size={17}/>{error}</div>}
    {message && <div className="action-success fifo-message" role="status"><ShieldCheck size={17}/>{message}</div>}
  </section>;
}
