import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Clock3, FileCheck2, PackageCheck, ScanBarcode, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './delivery-workflow.css';
import { ALLOWED_PHOTO_MIME, validateEvidencePhoto, deliveryCapabilities } from '../../lib/delivery-guards.js';

const BUCKET = 'at-delivery-evidence';
const packageLabel = value => String(value || 'pending').replaceAll('_', ' ');
const timestamp = value => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

/**
 * Phase 4 courier custody and private proof-of-delivery panel.
 *
 * Reads are limited by Supabase table RLS. Mutations are limited to the
 * existing server-authorized at_scan_package / at_confirm_delivery RPCs.
 * Uploaded photos never receive a public URL.
 */
export default function DeliveryWorkflow({
  assignment,
  organizationId,
  currentUserId,
  role,
  profile,
  onChanged,
  isDemo = false,
}) {
  const id = assignment?.id;
  const [packages, setPackages] = useState([]);
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [barcode, setBarcode] = useState('');
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const fileInputRef = useRef(null);
  const activeRequestRef = useRef(0);

  const planner = role === 'admin' || role === 'dispatcher';
  const courier = assignment?.division === 'Class C';
  const {canView, canScanPickup:canPickupScan, canScanDelivery:canDeliverScan,
    canConfirmDelivery} = deliveryCapabilities({
      assignment,organizationId,userId:currentUserId,role,
      verified:profile?.license_verified,isDemo,
    });
  const pickedUp = packages.filter(p => p.status === 'picked_up' || p.status === 'delivered').length;
  const delivered = packages.filter(p => p.status === 'delivered').length;

  const refresh = useCallback(async (requestId = ++activeRequestRef.current) => {
    if (!canView || !supabase) return;
    setLoading(true);
    const queries = [
      courier ? supabase.from('at_assignment_packages')
        .select('id,tracking_code,status,picked_up_at,delivered_at')
        .eq('organization_id', organizationId)
        .eq('assignment_id', id)
        .order('tracking_code', { ascending: true })
        .limit(250)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('at_delivery_proofs')
        .select('id,confirmed_at')
        .eq('organization_id', organizationId)
        .eq('assignment_id', id)
        .maybeSingle(),
    ];
    try {
      const [packageResult, proofResult] = await Promise.all(queries);
      if (activeRequestRef.current !== requestId) return;
      if (packageResult.error || proofResult.error) {
        setError(packageResult.error?.message || proofResult.error?.message || 'Unable to load delivery information.');
      } else {
        setPackages(packageResult.data || []);
        setProof(proofResult.data || null);
        setError('');
      }
    } catch (queryError) {
      if (activeRequestRef.current === requestId) {
        setError(queryError?.message || 'Unable to load delivery information.');
      }
    } finally {
      if (activeRequestRef.current === requestId) setLoading(false);
    }
  }, [canView, courier, organizationId, id]);

  useEffect(() => {
    const requestId = ++activeRequestRef.current;
    setPackages([]);
    setProof(null);
    setError('');
    setFeedback('');
    setBarcode('');
    setRecipient('');
    setNotes('');
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (canView) void refresh(requestId);
    return () => { activeRequestRef.current++; };
  }, [refresh, canView]);

  async function submitScan(event) {
    event.preventDefault();
    const code = barcode.trim();
    if (!supabase || busy || !code || (!canPickupScan && !canDeliverScan)) return;
    setBusy(true);
    setError('');
    setFeedback('');
    const action = canPickupScan ? 'pickup' : 'delivery';
    try {
      const { error: scanError } = await supabase.rpc('at_scan_package', {
        p_assignment_id: id,
        p_tracking_code: code,
        p_scan_type: action,
      });
      if (scanError) throw scanError;
      setBarcode('');
      await refresh();
      setFeedback('Package ' + action + ' scan saved to the custody log.');
      await onChanged?.();
    } catch (scanError) {
      setError(scanError?.message || 'Could not save package scan.');
    } finally {
      setBusy(false);
    }
  }

  async function submitDelivery(event) {
    event.preventDefault();
    if (!supabase || busy || !canConfirmDelivery || !recipient.trim() || !photo) return;
    const photoError=validateEvidencePhoto(photo);
    if (photoError) {setError(photoError);return;}
    if (!globalThis.crypto?.randomUUID) {
      setError('Secure HTTPS access is required for uploading delivery evidence.');
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    let uploaded = false;
    try {
      // Server policy validates the assignment, member, driver and status again.
      const evidencePath = [organizationId, id, currentUserId,
        crypto.randomUUID() + '.' + ALLOWED_PHOTO_MIME[photo.type]].join('/');
      const { error: uploadError } = await supabase.storage.from(BUCKET)
        .upload(evidencePath, photo, {
          contentType: photo.type,
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploaded = true;
      const { error: deliveryError } = await supabase.rpc('at_confirm_delivery', {
        p_assignment_id: id,
        p_recipient_name: recipient.trim(),
        p_evidence_path: evidencePath,
        p_notes: notes.trim(),
      });
      if (deliveryError) throw deliveryError;
      setPhoto(null);
      setRecipient('');
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFeedback('Delivery and private proof of delivery saved.');
      await refresh();
      await onChanged?.();
    } catch (deliveryError) {
      const suffix = uploaded
        ? ' The photo uploaded privately but the delivery was not confirmed. Operations must review the unreferenced evidence.'
        : '';
      setError((deliveryError?.message || 'Delivery confirmation failed.') + suffix);
    } finally {
      setBusy(false);
    }
  }

  if (isDemo) return <section className="at-delivery" aria-label="Sample delivery workflow">
    <div className="at-delivery-title">
      <div className="at-delivery-heading"><span className="at-delivery-icon"><PackageCheck size={19}/></span>
        <div><span className="at-kicker">SAMPLE WORKFLOW · NO DATABASE ACCESS</span><h3>Delivery & package verification</h3></div>
      </div>
      <span className="at-delivery-private"><ShieldCheck size={14}/> Private evidence</span>
    </div>
    <p className="at-delivery-description">Drivers can verify package custody and submit recipient/photo proof after the shipment reaches the appropriate state. This is a read-only design example.</p>
    <div className="at-delivery-metrics">
      <div><strong>3</strong><small>Example packages</small></div>
      <div><strong>3</strong><small>Picked up</small></div>
      <div><strong>2</strong><small>Delivered</small></div>
    </div>
    <p className="at-delivery-note">Barcode scanning and photo submission are disabled in demo mode. A verified assigned driver must use the live workspace.</p>
  </section>;

  if (!canView) return null;

  return <section className="at-delivery" aria-label="Package manifest and proof of delivery">
    <div className="at-delivery-title">
      <div className="at-delivery-heading">
        <span className="at-delivery-icon"><PackageCheck size={19} /></span>
        <div><span className="at-kicker">CHAIN OF CUSTODY</span><h3>Delivery & package verification</h3></div>
      </div>
      <span className="at-delivery-private"><ShieldCheck size={14}/> Private evidence</span>
    </div>
    <p className="at-delivery-description">
      {planner ? 'Read-only view of the assigned shipment. Only its driver can scan or confirm delivery.' :
        'Verify each parcel and submit proof using your authorized driver account.'}
    </p>

    {courier && <div className="at-delivery-manifest">
      <div className="at-delivery-metrics">
        <div><strong>{packages.length}</strong><small>On manifest</small></div>
        <div><strong>{pickedUp}</strong><small>Picked up</small></div>
        <div><strong>{delivered}</strong><small>Delivered</small></div>
      </div>
      {packages.length > 0 ?
        <div className="at-delivery-parcels">
          {packages.map(item => <div className="at-delivery-parcel" key={item.id}>
            <ScanBarcode size={16} />
            <strong>{item.tracking_code}</strong>
            <span className={'at-delivery-tag at-package-' + item.status}>{packageLabel(item.status)}</span>
          </div>)}
        </div>
      : <p className="at-delivery-note">No package manifest is available for this shipment.</p>}
    </div>}

    {(canPickupScan || canDeliverScan) && <form className="at-delivery-form" onSubmit={submitScan}>
      <h4><ScanBarcode size={17}/> {canPickupScan ? 'Record package pickup' : 'Record package delivery'}</h4>
      <label htmlFor="at-pod-barcode">Tracking code</label>
      <input id="at-pod-barcode" autoComplete="off" maxLength={120} value={barcode}
        onChange={event => setBarcode(event.target.value)}
        placeholder="Scan barcode or enter tracking number" required disabled={busy}/>
      <button type="submit" className="at-button at-button-primary" disabled={busy || !barcode.trim()}>
        {busy ? 'Saving scan…' : 'Record scan'} <CheckCircle2 size={16}/>
      </button>
      <small>Supports USB/Bluetooth keyboard-style barcode scanners and manual entry. Camera barcode recognition is not enabled.</small>
    </form>}

    {canConfirmDelivery && <form className="at-delivery-form" onSubmit={submitDelivery}>
      <h4><Camera size={17}/> Secure proof of delivery</h4>
      <label htmlFor="at-pod-recipient">Recipient name</label>
      <input id="at-pod-recipient" maxLength={120} required value={recipient}
        onChange={event => setRecipient(event.target.value)}
        placeholder="Name of person accepting shipment" disabled={busy}/>
      <label htmlFor="at-pod-photo">Delivery photo (required)</label>
      <input id="at-pod-photo" ref={fileInputRef} type="file" required accept="image/jpeg,image/png,image/webp"
        capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} disabled={busy}/>
      {photo && <small>Selected: {photo.name} · {(photo.size / 1024 / 1024).toFixed(2)} MB (10 MB maximum)</small>}
      <label htmlFor="at-pod-notes">Handoff notes (optional)</label>
      <textarea id="at-pod-notes" rows={3} maxLength={1000} value={notes}
        onChange={event => setNotes(event.target.value)}
        placeholder="Condition, exceptions, handoff location" disabled={busy}/>
      <button type="submit" className="at-button at-button-primary"
        disabled={busy || !photo || !recipient.trim()}>
        {busy ? 'Securing delivery proof…' : 'Confirm delivery'} <FileCheck2 size={16}/>
      </button>
      <small>Photos remain in private Supabase Storage. Delivery completion requires server validation, including manifest checks.</small>
    </form>}

    {proof && <div className="at-delivery-completed"><CheckCircle2 size={17}/>
      <div><strong>Delivery evidence recorded</strong><small>Confirmed {timestamp(proof.confirmed_at)}. Access remains private.</small></div></div>}
    {!proof && assignment.status === 'delivered' &&
      <div className="at-delivery-completed"><Clock3 size={17}/> Delivery is marked complete; no accessible proof record was returned.</div>}
    {error && <p className="at-delivery-error" role="alert"><ShieldAlert size={16}/>{error}</p>}
    {feedback && <p className="at-delivery-success" role="status"><CheckCircle2 size={16}/>{feedback}</p>}
    {loading && <p className="at-delivery-note" role="status">Refreshing manifest and proof status…</p>}
  </section>;
}
