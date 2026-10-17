# Andertrack Phase 8 — Intelligent Dispatch & Route Planning

## Scope and intent
An auditable **dispatcher decision-support pilot**, not autonomous dispatch, a predictive AI model, live road-traffic optimizer, HOS validation, or commercial truck navigation.

Phase 8 builds on the confirmed deployed Phase 7 Fleet Intelligence map, the Phase 5 server FIFO dispatch queue, and the Phase 6 shipment audit trail. No database migrations or new credentials are required.

## Features
- **Dispatch optimization** sidebar workspace for admins and dispatchers (driver roles denied).
- Choose a genuinely unassigned and unowned load from an existing organization-scoped Supabase query.
- Evaluate driver–vehicle combinations against verified driver license, class hierarchy, availability, enabled equipment, existing active driver assignments, existing active equipment assignments, and mandatory FIFO priority if dispatch requests are queued.
- Optional local **proposed shipment weight** scenario is checked against equipment `payload_capacity_lbs`; missing capacity or insufficient pounds fail screening. Because assignment weight is not stored in the current schema, **unknown payload is explicitly marked unchecked**, never claimed as safe.
- Optional manual pickup latitude/longitude. A fresh RLS-authorized matching `driver_location_current.driver_id` row yields a *straight-line* proximity comparison via Haversine distance, **not actual driving distance, road route, driver ETA, or HOS**. Unknown/stale GPS stays unknown and cannot become a fabricated distance.
- Best preliminary matches shown first; transparently show every reason a proposed pair is blocked under "Review all pairs".
- Queue head is determined by server `queue_number`, not by an invented driver ranking or estimated proximity. If any queued requests exist, only queue-head driver can be shown as eligible. Actual queuing/offer still uses the existing server-authorized dispatch RPC; Phase 8 never calls those RPCs itself.
- Existing **Review in dispatch** shortcut opens the load in the current dispatcher workflow.
- External **Open road route** passes the recorded pickup/delivery addresses to Google Maps using a proper encoded URL; Google Maps handles routing externally, and the app never claims commercial-vehicle safety.
- Demo mode uses explicitly sample records (one available Class C driver, one free Class C van with stated capacity, a sample queued request, and a recent sample GPS location). No Supabase requests or writes.

## Database & security
Verified schema fields:
- `at_assignments.id,status,division,driver_user_id,vehicle_id,pickup_address,dropoff_address,scheduled_pickup_at`.
- `at_driver_profiles.user_id,display_name,license_class,license_verified,availability`.
- `at_vehicles.id,unit_number,required_license_class,enabled,payload_capacity_lbs`.
- `at_dispatch_requests.queue_number,status,driver_user_id,requested_at`.
- `driver_location_current.driver_id,latitude,longitude,last_ping_at`.
Read queries remain scoped to the user's active organization and server RLS. Existing database procedure `at_claim_next_dispatch` is the only authority to allocate queued requests, and manual offers still use `at_offer_assignment` with server checks. No driver/customer data is sent to AI services. Manually provided pickup coordinates and payload are in ephemeral React state only.

## Explicit limitations
- No saved pickup/drop-off GPS coordinates, complete shipment mass, road network contract, traffic, fuel model, route restrictions, truck clearance, live distance matrices, HOS duty status, endorsements, or historical outcomes sufficient for meaningful ETA prediction. Do not claim those features exist.
- Case-by-case screening is advisory; permissions, concurrent assignment changes, queue order and legal compliance are rechecked by server rules and dispatcher.
- Candidate ranks prioritize known, fresh GPS proximity only as a tie-breaker *after* eligibility and FIFO. Proximity unknown is not an automatic disqualification.
- Up to 150 visible assignments, 200 driver profiles, 250 vehicles and 250 current GPS devices are present in the existing workspace queries; no guaranteed exhaustive fleet optimizer.
- Route plan opens a third-party site and may share address data with Google after operator action. It does not automatically send addresses.
- No background automation, real assignment change or persistent review record is created by this phase.

## QA and release gate
- Node tests: FIFO queue-head isolation, class hierarchy, license verification, availability, active assignment conflict, payload unknown/excess restrictions, fresh GPS accuracy, input validation, and external route address encoding.
- GitHub Actions regression tests plus Vite production bundle; Vercel preview READY.
- Authenticated browser E2E with admin, dispatcher and driver identities, including RLS tenant isolation and FIFO races, remains necessary before production merge.
- Manual mobile and desktop dark/light checks, incomplete/null data, keyboard controls and route handoff.
- No Supabase schema, policy or SMTP changes. Phase 8 is a reviewable PR until explicit approval of release.
