# Andertrack — Reference-inspired Fleet Health + Dispatch Mode dashboards

## Scope
Implement the two user-provided design references as **functional React views**, not screenshot backgrounds or static mockups. Adopt their charcoal/orange Fleet Health and deep gray/teal Dispatch Mode visual language. Preserve existing sidebar, active Dispatch Center FIFO, ARCVIEW Driver Cockpit, shipment detail/POV, RLS and authentication architecture.

## Fleet Health
- Sidebar item: **Fleet Health**.
- Snapshot of registered vehicles, current GPS reporters with active assignments, GPS idle, unreported and disabled vehicles.
- Search by unit or assigned driver, filter by actual reporting status, sort, paginate, inspect equipment detail, and navigate to the current fleet roster/tracking.
- Live vehicle status requires an actual matching `driver_location_current` device by `vehicle_id` when available or normalized unique unit number. Current GPS is accepted only when timestamp is valid and <=5 minutes old.
- Driver names from actual active assignments (`at_driver_profiles` and `at_assignments`).
- **No maintenance, fault codes, sensors, health scores, engine values or dated diagnostic assessments are stored in the current Supabase contract.** Live Fleet Health therefore does NOT manufacture a score, score breakdown, maintenance incidents, work orders or a health trend. The corresponding visual panels show "Not connected" and explain required feeds.
- **Sample mode only:** fictional five-level health scores, illustrative service alerts, donut, radial gauge, and synthetic orange historical trend. Every panel and page banner labels them fictional.
- Read-only; no maintenance status or vehicle record is edited by this view.

## Dispatch Mode
- Sidebar item: **Dispatch Mode**.
- Screenshot-inspired split-screen dispatch workspace: current shipment selector and search, large map, pickup/drop-off details, equipment and driver panel, operations context, and messaging area.
- Uses existing Leaflet/FleetMap for *reported GPS points only*; no synthetic live routes, traffic ETA, guidance or speed-limit values.
- A **fresh** GPS point is displayed only for the driver linked to the selected assignment; no other fleet driver positions are dumped into that detail map.
- Existing protected dispatch actions accessible by "Open assignment" and "Dispatch queue" navigation. No new RPC or assignment mutation here.
- Opens an *external Google Maps directions page* only on user click if both addresses are present. This is not validated truck navigation.
- Live messaging remains **NOT CONNECTED** because the current schema does not include a tenant-scoped message thread and delivery confirmation. Do not create or send real chat messages.
- **Sample mode only:** three synthetic dispatch bubbles, working local-only message composer with no network request, clearly fictitious trip-time comparison chart. Live mode displays no invented chat history or trip timing.

## Access & security
- Both new views are restricted to an authenticated organization admin/dispatcher, or explicitly sample-mode demo; driver role does not see fleet-wide details. RLS remains the ultimate database boundary.
- Workspace data is already RLS/organization-scoped in `LiveWorkspace.jsx`. No additional Supabase calls, keys, migrations, permissions or SMTP changes.
- Existing data quality limits apply: current lists are capped (150 assignments, 200 drivers, 250 vehicles and GPS). Aggregates are of the loaded visible scope, not necessarily full company totals when beyond the cap.
- Samples are local-only and should never appear as real vehicles, health records or messages.
- Demo mapping IDs for fictional sample GPS were extended in `src/App.jsx`; no persistent data affected.

## QA gates
1. Run `npm test` and `npm run build`. New regression coverage verifies no fictitious live health scores, calculated GPS state, driver matching, filters, sample isolation and selected-driver map scope.
2. Vercel preview must report READY, and the PR must be mergeable.
3. Manual checks: mobile/desktop, navigation sidebar discoverability, dark/light mode, focus and keyboard accessibility, search/filter/page interactions, vehicle detail open/close, selected shipment isolation, local-only demo chat, and empty data states.
4. Role/RLS browser tests with separate organizations and real driver/admin/dispatcher accounts.
5. To add actual maintenance history, fleet health KPIs or real messaging, plan database governance + connectors separately. Never merge a fabricated production health-score algorithm.
6. No main/production merge before preview approval.
