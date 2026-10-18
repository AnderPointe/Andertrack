# Class C Local Fleet Operations — Northvale-inspired UI

## Four workspaces
New sidebar item **Class C Fleet**, with four tabs from the requested interface:
1. **Dashboard**: Fleet KPIs, a working Class C vehicle carousel/showcase with the existing interactive 3D model, a near-term service activity feed, actual-vs-forecast maintenance cost spline, fleet readiness and system-condition cards. Demo figures: 128 vehicles, 115 active, 15 maintenance, 28 critical alerts, $4,592 actual vs $5,100 forecast in June 2026. These values are **fictional demonstration metrics** in sample mode only.
2. **Vehicles**: Active/service/critical sample comparison, 86/100 sample semi-circle gauge, 05/18/105 status grouping, fake diagnostic stream, searchable equipment comparison and working 3D vehicle inspection. Live mechanical health, fault codes and diagnostic scores show **NOT CONNECTED**.
3. **Service Plan**: The five sample service counters, Monday–Friday workshop calendar and **+ New Service** modal. Validate vehicle, job, day, time and bay; show newly created appointment, allow deleting local draft. **These appointments are local state only, not actual maintenance work orders**, until a back-end is reviewed.
4. **Analytics**: Original CSS top-down vehicle inspection illustration with red brake/tire hotspots, six illustrated subsystem bars, actual-vs-budget and operating cost splits, budget utilization and example AI-style insights. All device data, costs and recommendations are clearly sample-only when not backed by the database.

## Class C driver shift ribbon
- Placed at top of **Class C Fleet** and also **Driver Cockpit & HOS** for logged-in Class C drivers (or the sample local-delivery demo driver).
- Contains assigned vehicle unit, manually started/paused session timer, a count of available Class C shipment records, earnings/tips integration status, and a DVIR defect draft action.
- Live earnings and actual per-stop/tip records do not exist. No driver payout figures are invented in production.
- The session timer is client-side and **not a legal log, certified ELD, or a durable timesheet**.
- The **DVIR defect report** modal requires vehicle, defect category, driver assessment and optional explanation. Validates and exports a JSON file explicitly marked **LOCAL DRAFT — NOT SUBMITTED**. Critical defects still require your established company reporting process; this draft is **not a completed DVIR submission**, compliance document, or notification.

## GVWR / license qualification
- Class C planning considers cargo vans, Sprinters, light box trucks, pickups, utility vehicles and similar equipment by category.
- **A named body type cannot prove non-CDL eligibility**. If `gvwr_lbs` is missing, the UI explicitly flags the lack of verified GVWR. A vehicle is excluded when its known GVWR is 26,000 lbs or above; federal/state CDL classifications also depend on combined ratings, trailers, passenger/hazmat uses and other rules, which this sample planner does **not** evaluate.
- Heavy tractor category excluded. If the driver role is signed in, only the driver’s own active, linked Class C equipment/assignments are visible in this workspace, using the existing RLS-filtered data.
- Fleet-wide screens are reserved for organization admins/dispatchers, except explicitly synthetic demo mode.

## Data boundary, migrations & next steps
- **No Supabase schema or RLS changes were applied**. Current live tables `at_vehicles`, `at_driver_profiles`, and `at_assignments` have no DVIR/work-order/OBD/TPMS/maintenance-invoice/shift-pay tables; actual data shows unavailable values.
- Service appointments and DVIR downloads are implemented as local drafts only; production-grade service and DVIR must have authenticated submission, organization RLS, signed audit trail, immutable event timestamps, repair validation/clearance, and maintenance acknowledgement. Optional draft schema design can be prepared in a follow-on phase.
- Performance: live count summaries reflect **loaded organization-scoped records**, not guaranteed warehouse total beyond current query caps.
- Vehicle 3D representations remain **generic concept renderings** and are not licensed 3D replicas.

## Release checklist
1. GitHub regression suite and Vite production build green; Vercel preview READY for the latest commit.
2. Manual QA: desktop and 360px mobile, sample vs signed-in admin vs signed-in Class C driver, tab switching, sample 3D selection, service draft creation/removal, DVIR download content, shift timer start/pause, keyboard and reduced-motion.
3. Role isolation and license/GVWR rules tested. Real defect or safety-critical reports must never silently pretend to be transmitted.
4. No merge to main or production until reviewer approval. Further integrations require their own authorization.

## Maps integration — Class C fleet and local drivers
- A **Live Vehicle Map & Dispatch Routes** panel sits directly above the Dashboard summary. It reuses Andertrack's built-in Leaflet/OpenStreetMap and the existing Supabase `driver_location_current` feed, so no Google Maps API key, Google billing or new backend credential is required to view authorized fleet positions.
- Dispatcher/admin mode filters RLS-scoped GPS down to fresh pings (no older than five minutes) matched to **both** active Class C vehicle assignment and its driver. Units with no active assignment or GPS do not appear as live pins, even if registered in inventory; Class C candidate types still need verified GVWR. Select a vehicle to focus the map and see GPS freshness, reported speed, assignment reference, pickup and drop-off.
- Driver mode permits only their *own* GPS with `company_id` **and** `driver_id` filters in the query; Supabase RLS must still authorize access. Errors/denials show an empty position rather than falling back to all fleet telemetry. In the Driver Cockpit, a collapsed **Show my local delivery map** button reveals a matching read-only map for Class C drivers.
- **Directions in Google Maps** opens a public external Google Maps directions page **only when clicked** and when both pickup/drop-off addresses exist. Opening a live position also requires an explicit click. Coordinates/addresses are shared with Google only when those links are opened. Neither link creates or validates commercial-truck navigation, live traffic ETA, restricted-road allowances or turn-by-turn in-app navigation.
- Existing OpenStreetMap tiles remain the map base; production tile quotas/attribution should be reviewed if usage grows. For embedded Google Maps, a separately authorized Google Maps Platform key, billing and API restrictions would be needed.
- Sample dashboard GPS feed is clearly labeled **SYNTHETIC SAMPLE FEED**; it uses the sample delivery assignment and sample GPS data already present in the app, not a real customer's live location.
- The Class C map makes no Supabase writes and does not modify delivery, maintenance, HOS, service or DVIR records. Unit-to-driver joins and map URL guards are regression-tested in `tests/class-c-maps.test.mjs`. Authenticated cross-tenant and mobile browser tests remain a release gate.
