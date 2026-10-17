# Andertrack Phase 6 — Shipment Control Tower

## Goal
Connect FIFO dispatch (Phase 5) and chain-of-custody / proof-of-delivery (Phase 4) in a single, trustworthy shipment timeline. This phase is read-only and does **not** add automation that can mark loads delivered.

## Capabilities
- New **Shipment journeys** sidebar route and command-palette destination.
- Timeline embedded in shipment details, plus a dedicated timeline/shipments split view.
- Recorded creation and assignment transition events (offers, accepts, declines, pickup, transit, delivery), package custody scans and private proof metadata, ordered by recorded time.
- Milestone coverage based on **actual events**, not derived from current shipment status. A 57% value describes event-record coverage only, never trip progress.
- Schedule watch using the `at_assignments.scheduled_delivery_at` field: unscheduled, more than two hours out, two-hour window, or scheduled time passed without a delivered status. No ETA model and no on-time compliance claim.
- Read-only filtered views for assignment, packages and delivery proof; export only visible events as a CSV with spreadsheet-formula neutralization.
- Sample-mode timeline explicitly labeled as illustrative; no Supabase reads or mutations in demo mode.
- UI automatically polls authorized record history every 30 seconds while the tab is visible, plus a manual refresh.

## Live data and access
Verified in both production and staging schemas:
- `public.at_assignment_events` (actor, action, status transition, occurred_at).
- `public.at_package_events` (package_id, action, scanned_at).
- `public.at_assignment_packages` (package_id to tracking_code).
- `public.at_delivery_proofs` metadata (`id,confirmed_at` only).
- `public.at_assignments` includes `scheduled_pickup_at`, `scheduled_delivery_at`.
- Authenticated SELECT permissions with RLS: dispatch/admin organization access and drivers restricted to their assigned shipment rows.
- No recipient name, object storage path, photo URL, signature, or unscoped driver/user metadata is queried in this phase.
- Per-source query cap is the most recent **200** rows; show truncation context. Historical completeness beyond caps is not guaranteed.

## Test plan
1. Verify role-separated access in the browser (admin, dispatcher and assigned driver) with seeded non-production assignments. Confirm other drivers/tenants see nothing.
2. Test immutable event ordering, filter behavior, CSV injection, invalid timestamps and no invented milestones with `npm test`.
3. Confirm the production bundle with `npm run build` and verify Vercel preview.
4. Verify new events appear after 30-second visible-tab poll or manual refresh; ensure no duplicate event display on refresh.
5. Confirm dark/light responsiveness and keyboard command search can open Shipment journeys.
6. Check that a delivery proof shows only "Recorded" without exposing private evidence fields.
7. Staging data is not populated with driver assignments or actual POD recordings; end-to-end browser event review is pending authorization and data.

## Release policy
No SQL migrations, Supabase policy changes, auth setting changes or new production credentials are included. Keep as a draft PR pending build checks and authorized browser QA; production main remains unchanged until approval.
