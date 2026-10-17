# Andertrack Phase 7 — Advanced Fleet Intelligence

## Capabilities
- New **Fleet intelligence** navigation and route replay from the existing `driver_location_events` table, limited to latest 500 authorized samples per vehicle in a selectable 6h/24h/7d window.
- Interactive Leaflet breadcrumb map, manual timestamp scrubber, play/pause, beginning/end markers and a GPS route shown as **straight segments**. The route is not a suggested road route.
- Latest reported vehicle speed, heading, accuracy, battery level, signal strength and freshness from `driver_location_current`.
- Data-quality analytics: valid samples, accepted straight-line segments, approximate trace distance, and rejected unrealistic jumps. Not an odometer or compliance finding.
- In-browser, click-to-place configurable circular monitoring zone. Current positions outside the circle generate **review-only local observations**, not persistent geofence events.
- Review-only stale GPS and speed signals. A speed above 80 mph only prompts context review; the UI never asserts a speeding violation.
- Demo movement is clearly synthetic, deterministic offsets from sample unit positions and **never queries Supabase**.
- Real production has zero current GPS rows and zero history rows at implementation time. The interface will show accurate empty states until the collector is operational and the RLS policy is approved.

## Security / database
- Current GPS (`driver_location_current`) already has a SELECT policy for admin/dispatcher of the matching `company_id = at_organizations.id`.
- Historical GPS (`driver_location_events`) has **RLS enabled but no SELECT policy**. Do not disable RLS or grant permissive public access. Phase 7 preview therefore cannot read real historical positions until a reviewed, organization-scoped policy is deployed.
- A **review-only** SQL policy proposal is in `supabase/sql/phase7_gps_history_select_review.sql`. It is not applied to staging or production and needs data-governance review: retention, expected driver history visibility, subscriber load, rate limits, geofence incident semantics.
- Phase 7 requests `driver_location_events` only for users whose fetched org role is admin/dispatcher; also filters `company_id` and selected `driver_id` in the request and relies on server RLS for actual authorization. No client secret keys. Driver-side role cannot query history.
- No new GPS points, mock fleet assets, inferred ETAs, geofence alerts, or incidents written into the production DB.
- Geofence center, radius and speed thresholds are local-only presentation controls, with no persistent database audit effect.
- Route history is capped; truncated data should not be used for route completeness, billing, proof of driver route or regulatory decisions.
- Public OSM tile server still lacks a commercial SLA. Choose a licensed tile provider before scaling.

## Release gates
- Tests: GPS validation, replay ordering, duplicate/future/low-quality rejection, suspect-jump filtering, Haversine distance, monitoring circle and stale/speed cues.
- GitHub CI: `npm test` then Vite production build; Vercel preview READY.
- Manual QA: desktop/mobile responsive layouts, keyboard and touch sliders, role-scoped auth, map recenter behavior, denied history policy empty state, large-history paging/truncation, and tenant switching.
- Do not merge Phase 7 to production until the preview is inspected. Do not deploy history RLS policy without review.
