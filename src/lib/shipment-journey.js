// Read-only, auditable shipment journey projections.
// Never infer historical events solely from the current shipment status.
const ACTION_LABELS = Object.freeze({
  offer: 'Assignment offered',
  accept: 'Offer accepted',
  decline: 'Offer declined',
  arrive_pickup: 'Arrived at pickup',
  pickup: 'Shipment picked up',
  start_transit: 'Departed for delivery',
  deliver: 'Delivery completed',
});

export const JOURNEY_STEPS = Object.freeze([
  { id: 'created', label: 'Created' },
  { id: 'offer', label: 'Offered' },
  { id: 'accept', label: 'Accepted' },
  { id: 'arrive_pickup', label: 'At pickup' },
  { id: 'pickup', label: 'Picked up' },
  { id: 'start_transit', label: 'In transit' },
  { id: 'deliver', label: 'Delivered' },
]);

export const JOURNEY_KINDS = Object.freeze(['all', 'assignment', 'package', 'proof']);
const validDate = timestamp => {
  const millis = Date.parse(timestamp ?? '');
  return Number.isFinite(millis) ? millis : null;
};
const labelStatus = value => String(value ?? 'unknown').replaceAll('_', ' ');

export function buildJourney({ assignment, assignmentEvents = [], packageEvents = [],
  proof = null, packageLabels = {} } = {}) {
  if (!assignment?.id) return [];

  const entries = [];
  const created = validDate(assignment.created_at);
  if (created !== null) {
    entries.push({
      id: 'created:' + assignment.id, kind: 'assignment', action: 'created',
      title: 'Shipment created', detail: 'Shipment record created',
      timestamp: assignment.created_at, actorId: null,
    });
  }

  for (const event of assignmentEvents) {
    if (event.assignment_id !== assignment.id || validDate(event.occurred_at) === null) continue;
    const transition = event.previous_status && event.next_status
      ? labelStatus(event.previous_status) + ' → ' + labelStatus(event.next_status)
      : 'Status transition recorded';
    entries.push({
      id: 'assignment:' + event.id, kind: 'assignment', action: event.action,
      title: ACTION_LABELS[event.action] || 'Assignment event: ' + labelStatus(event.action),
      detail: transition, timestamp: event.occurred_at,
      actorId: event.actor_user_id || null,
    });
  }

  for (const event of packageEvents) {
    if (event.assignment_id !== assignment.id || validDate(event.scanned_at) === null) continue;
    const code = packageLabels[event.package_id];
    entries.push({
      id: 'package:' + event.id, kind: 'package', action: event.action,
      title: event.action === 'pickup' ? 'Package pickup scan' :
        event.action === 'delivery' ? 'Package delivery scan' : 'Package custody scan',
      detail: code ? 'Tracking: ' + code : 'Recorded package custody event',
      timestamp: event.scanned_at,
      actorId: event.actor_user_id || null,
    });
  }

  if (proof?.confirmed_at && validDate(proof.confirmed_at) !== null) {
    entries.push({
      id: 'proof:' + (proof.id || assignment.id), kind: 'proof',
      action: 'proof', title: 'Proof of delivery recorded',
      detail: 'Private evidence metadata saved. Photo and recipient details are not included here.',
      timestamp: proof.confirmed_at, actorId: null,
    });
  }
  return entries.sort((a, b) => validDate(b.timestamp) - validDate(a.timestamp)
    || a.id.localeCompare(b.id));
}

export function journeyMilestones(assignment, assignmentEvents = []) {
  const actionSet = new Set(assignmentEvents
    .filter(e => e.assignment_id === assignment?.id && validDate(e.occurred_at) !== null)
    .map(e => e.action));
  return JOURNEY_STEPS.map(step => ({
    ...step,
    complete: step.id === 'created'
      ? validDate(assignment?.created_at) !== null
      : actionSet.has(step.id),
  }));
}

export function journeySchedule(assignment, now = Date.now()) {
  const due = validDate(assignment?.scheduled_delivery_at);
  if (due === null) return { kind: 'unset', label: 'Delivery time not scheduled', due: null };
  if (assignment?.status === 'delivered') return {
    kind: 'recorded', label: 'Delivery is marked complete', due: assignment.scheduled_delivery_at,
  };
  const remaining = due - now;
  if (remaining < 0) return {
    kind: 'late', label: 'Scheduled time passed · delivery not yet recorded',
    due: assignment.scheduled_delivery_at,
  };
  if (remaining <= 120 * 60_000) return {
    kind: 'near', label: 'Within two hours of scheduled delivery',
    due: assignment.scheduled_delivery_at,
  };
  return {
    kind: 'scheduled', label: 'Delivery time scheduled',
    due: assignment.scheduled_delivery_at,
  };
}

export function journeyCsv(entries = []) {
  const safe = value => {
    const raw = String(value ?? '');
    const valueSafe = /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + valueSafe.replaceAll('"', '""') + '"';
  };
  return [
    ['Timestamp UTC', 'Category', 'Event', 'Description'].map(safe).join(','),
    ...entries.map(e => [e.timestamp, e.kind, e.title, e.detail].map(safe).join(',')),
  ].join('\r\n');
}
