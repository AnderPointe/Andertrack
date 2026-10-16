import React, { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, PackageCheck, ScanBarcode, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export default function DeliveryWorkflow({ assignment, organizationId, currentUserId, profile, onChanged }) {
  const a = assignment;
  const [packages, setPackages] = useState([]);
  const [packageError, setPackageError] = useState('');
  const [barcode, setBarcode] = useState('');
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const isCourier = a?.division === 'Class C';
  const canPickupScan = isCourier && a?.status === 'at_pickup';
  const canDeliverScan = isCourier && a?.status === 'in_transit';

  const refreshPackages = useCallback(async () => {
    if (!supabase || !a?.id || !isCourier) {
      setPackages([]); setPackageError(''); return;
    }
    const { data, error: queryError } = await supabase.from('at_assignment_packages')
      .select('id,tracking_code,status,picked_up_at,delivered_at')
      .eq('assignment_id', a.id).eq('organization_id', organizationId)
      .order('tracking_code', { ascending: true }).limit(150);
    if (queryError) setPackageError(queryError.message);
    else { setPackageError(''); setPackages(data || []); }
  }, [a?.id, organizationId, isCourier]);

  useEffect(() => {
    setBarcode(''); setRecipient(''); setNotes(''); setPhoto(null); setError(''); setFeedback('');
    setPackages([]); setPackageError('');
    refreshPackages();
  }, [refreshPackages]);

  async function scan(event) {
    event.preventDefault();
    if ((!canPickupScan && !canDeliverScan) || !barcode.trim()) return;
    setBusy(true); setError(''); setFeedback('');
    const eventType = canPickupScan ? 'pickup' : 'delivery';
    try {
      const { error: scanError } = await supabase.rpc('at_scan_package', {
        p_assignment_id: a.id,
        p_tracking_code: barcode.trim(),
        p_scan_type: eventType,
      });
      if (scanError) throw scanError;
      setFeedback('Package ' + eventType + ' scan confirmed.');
      setBarcode('');
      await refreshPackages();
    } catch (err) { setError(err?.message || 'Scan could not be saved.'); }
    finally { setBusy(false); }
  }

  async function confirmDelivery(event) {
    event.preventDefault();
    if (a.status !== 'in_transit' || !profile?.license_verified) return;
    setError(''); setFeedback('');
    if (!recipient.trim() || !photo) { setError('Recipient and delivery photo are required.'); return; }
    if (!TYPES[photo.type] || photo.size > MAX_PHOTO_BYTES) {
      setError('Use a JPEG, PNG or WebP photo no larger than 10 MB.'); return;
    }
    if (!globalThis.crypto?.randomUUID) { setError('A secure browser connection is required.'); return; }
    setBusy(true);
    try {
      const path = [organizationId, a.id, currentUserId, crypto.randomUUID() + '.' + TYPES[photo.type]].join('/');
      const { error: uploadError } = await supabase.storage.from('at-delivery-evidence').upload(path, photo, {
        contentType: photo.type, cacheControl: '3600', upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: submitError } = await supabase.rpc('at_confirm_delivery', {
        p_assignment_id: a.id,
        p_recipient_name: recipient.trim(),
        p_evidence_path: path,
        p_notes: notes.trim(),
      });
      if (submitError) throw submitError;
      setFeedback('Proof of delivery confirmed and saved.');
      setPhoto(null);
      setRecipient('');
      await onChanged?.();
    } catch (err) {
      setError((err?.message || 'Delivery confirmation failed.') +
        ' If the photo uploaded but confirmation failed, it is held privately for administrator cleanup.');
    } finally { setBusy(false); }
  }

  if (!a || !currentUserId || a.driver_user_id !== currentUserId) return null;
  if (!['at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(a.status)) return null;

  return <section className="delivery-workflow">
    <div className="sectionhead"><h3><PackageCheck size={17}/> {isCourier ? 'Courier package verification' : 'Freight delivery documents'}</h3></div>
    {isCourier && <>
      {packageError && <p className="action-error" role="alert"><ShieldAlert size={15}/>{packageError}</p>}
      <p className="muted">Packages on manifest: <strong>{packages.length}</strong>. Scanned at pickup: <strong>{packages.filter(x => x.status !== 'pending').length}</strong>. Delivered: <strong>{packages.filter(x => x.status === 'delivered').length}</strong>.</p>
      {packages.length > 0 && <div className="package-list">{packages.map(p =>
        <div className="package-line" key={p.id}><span>{p.tracking_code}</span><span className="pill">{p.status.replaceAll('_', ' ')}</span></div>)}</div>}
      {(canPickupScan || canDeliverScan) && <form onSubmit={scan} className="delivery-form">
        <label htmlFor="package-code"><ScanBarcode size={16}/> {canPickupScan ? 'Scan package at pickup' : 'Scan package at delivery'}</label>
        <input id="package-code" autoComplete="off" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan barcode or enter tracking code" maxLength={120} required/>
        <button type="submit" className="primary" disabled={busy || !barcode.trim()}>{canPickupScan ? 'Confirm package pickup' : 'Confirm package delivery'}</button>
        <small className="muted">Supports keyboard-style barcode scanners and typed tracking codes. Camera-based barcode reading is planned for a later release.</small>
      </form>}
    </>}
    {a.status === 'in_transit' && <form onSubmit={confirmDelivery} className="delivery-form">
      <h4><Camera size={17}/> Proof of delivery</h4>
      <label htmlFor="pod-recipient">Recipient name</label>
      <input id="pod-recipient" value={recipient} onChange={e => setRecipient(e.target.value)} required maxLength={120} placeholder="Name of person receiving shipment"/>
      <label htmlFor="pod-photo">Delivery confirmation photo (required)</label>
      <input id="pod-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
        onChange={e => setPhoto(e.target.files?.[0] || null)} required/>
      <label htmlFor="pod-notes">Delivery notes (optional)</label>
      <textarea id="pod-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder="Condition, handoff location, exceptions"/>
      <button type="submit" className="primary" disabled={busy || !profile?.license_verified || !photo || !recipient.trim()}>
        {busy ? 'Submitting securely…' : 'Confirm delivery and save proof'} <CheckCircle2 size={16}/>
      </button>
      <small className="muted">Proof is stored in a private bucket and verified by a server-side transaction. No public image URLs are created. Customer signature and BOL workflows will be added separately.</small>
    </form>}
    {a.status === 'delivered' && <p className="action-success"><CheckCircle2 size={15}/> Delivery recorded. Proof is retained privately for an authorized operations review.</p>}
    {error && <p className="action-error" role="alert"><ShieldAlert size={15}/>{error}</p>}
    {feedback && <p className="action-success" role="status"><CheckCircle2 size={15}/>{feedback}</p>}
  </section>;
}
