/**
 * Client-side presentation guards only. Supabase RLS, Storage policy and
 * at_private RPC validation remain the actual authorization boundaries.
 */
export const DELIVERY_STATES = new Set(['at_pickup','picked_up','in_transit','delivered']);
export const ALLOWED_PHOTO_MIME = Object.freeze({
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp',
});
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function deliveryCapabilities({ assignment, organizationId, userId, role, verified, isDemo=false }) {
  const planner = role === 'admin' || role === 'dispatcher';
  const assignedDriver = role === 'driver' && Boolean(userId) &&
    assignment?.driver_user_id === userId;
  const eligible = Boolean(!isDemo && organizationId && assignment?.id &&
    DELIVERY_STATES.has(assignment.status) && (planner || assignedDriver));
  const courier = assignment?.division === 'Class C';
  return {
    canView:eligible,
    canReadManifest:eligible && courier,
    canScanPickup:eligible && assignedDriver && courier && assignment.status === 'at_pickup',
    canScanDelivery:eligible && assignedDriver && courier && assignment.status === 'in_transit',
    canConfirmDelivery:eligible && assignedDriver && assignment.status === 'in_transit' && verified === true,
  };
}

export function validateEvidencePhoto(photo) {
  if (!photo) return 'Attach a delivery photo.';
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_PHOTO_MIME, photo.type) ||
    !Number.isFinite(photo.size) || photo.size <= 0 || photo.size > MAX_EVIDENCE_BYTES) {
    return 'Attach a JPEG, PNG, or WebP photo between 1 byte and 10 MB.';
  }
  return '';
}
