# Andertrack Phase 4 — delivery workflow integration into Command Center V2

## Why this exists
Historical PR #4 (feature/phase-4-live-fleet-pod) was written before the redesigned dashboard and conflicts with V2's FleetMap, LiveWorkspace and styles. PR #11 already merged the fleet map reconciliation. This change selectively ports **package custody scans and private proof of delivery** into the current V2 shipment-detail panel without replacing its auth, command palette, dispatch queue or map.

## User functionality
- Assigned driver, Class C courier: view RLS-scoped manifest and scan tracking codes at pickup (shipment status at_pickup) and delivery (in_transit), via protected `at_scan_package` RPC.
- Assigned verified CDL and Class C drivers: recipient name, optional handoff notes and required JPEG/PNG/WebP photo (up to 10 MiB) for `in_transit` proof, uploaded to the private `at-delivery-evidence` bucket, then finalized through `at_confirm_delivery` RPC.
- Admin/dispatcher: RLS-scoped, read-only manifest counts and delivery-proof status in shipment detail, **no** scan or confirmation actions.
- Demo: a clearly labeled, non-mutating illustrative panel; no Supabase queries or writes.
- Errors displayed inline. A photo uploaded without a successful confirmation may be orphaned and requires trusted administrator cleanup. No public object URLs.
- The status and manifest are synced after successful RPCs. A driver cannot use this panel to bypass the server-authorized dispatch, manifest or license checks.

## Database verification
Read-only checks confirm both Supabase projects already contain:
- `at_assignment_packages`, `at_package_events`, `at_delivery_proofs`.
- Authenticated-only wrappers `at_scan_package` and `at_confirm_delivery` with previously reviewed private implementations.
- Private `at-delivery-evidence` bucket (10 MiB and JPEG/PNG/WebP restriction).
- `authenticated` SELECT grants with org/driver-scoped RLS and Storage policies. **No schema or policy changes in this PR**.

## Release gates
- PR build and native Node tests must pass; Vercel preview should be READY.
- Authenticated, role-separated browser tests are still needed for driver scans and private proof uploads. Staging has an admin account but not a driver profile and manifest; do not claim completed end-to-end proof upload tests.
- Manual checks: dispatcher cannot submit evidence; driver cannot see another driver's load; invalid MIME/oversized photo is rejected; failed confirmation keeps the shipment undelivered; all manifests prevent delivery until required scans are recorded.
- Storage cleanup and file-content verification (not just declared MIME) require a separate trusted backend process before high-volume rollout.
- Do not merge the old PR #4 over the V2 UI. The original PR can be closed as superseded after review.
