# Andertrack — Modern Warehouse/Delivery Dashboards + Interactive 3D Fleet

## Reference direction
The two user-provided images `Tractor Dashboard.webp` and `Delivery Dasboard.jpeg` establish a bright white/mint operations visual style. This feature adds two accessible pages inspired by their information architecture, alongside Andertrack's existing command center, without reproducing third-party logos or using copied proprietary graphics.

## New pages
- **Warehouse Operations:** white-card fleet staging grid, searchable/filtered vehicles, grid/list toggle, assignment/driver/route details, KPI band, and a click-to-open 3D equipment inspector. Only actual inventory, assignments and driver links are used in live mode.
- **Delivery Overview:** bright logistics overview, hero layout, KPI cards for total/delivered/active assignments, actual last-seven-days shipment creation histogram, searchable orders with authorized review action, and a selectable recorded vehicle with 3D preview.
- Neither claims real loading kilograms, dock occupancy, loading percentage, revenue, sales, freight ETA, proprietary truck images or maintenance sensor feeds when data is not available. Sample progress is visible **only** in demo.

## Interactive real 3D rendering
- Uses **Three.js** WebGL (no stock screenshot overlays or fake CSS-only tilt) with five original *procedural* vehicle categories:
  tractor/sleeper, box truck, cargo van, hotshot/pickup-trailer and pickup truck.
- Controls: drag to orbit, front/side/three-quarter cameras, auto-rotate on/off, zoom and five color swatches. A make/model **concept selector** offers Volvo VNL, Freightliner Cascadia, Kenworth/Peterbilt tractors, Freightliner M2/Isuzu box trucks, Ford Transit/Mercedes Sprinter vans, and Ford/Ram pickups. Presets change the generic body category and an illustrative title, NOT an exact OEM model. User actions affect the client preview only.
- Original generic geometry includes individual tires, chrome rims, cabin/glass, cargo sections, lights, accents and shadow. These are **not licensed manufacturer CAD/GLB** and cannot be represented as an exact digital twin of a specific VIN.
- Browser without WebGL gets a usable no-3D fallback.
- WebGL geometry/materials and renderer are disposed upon vehicle or page switch; no model network fetch or third-party tracking. Reduced-motion settings disable the default auto rotation.
- **Driver Cockpit:** "My assigned vehicle · 3D" shows equipment from the driver's authenticated, active shipment and authorized inventory; demo shows a sample unit. The catalog selector cannot reassign vehicles.
- **Dispatch Mode:** adds role-gated driver/equipment profile gallery. Profile → active assignment → `vehicle_id` → inventory. Select a driver to rotate the linked vehicle. Driver license/availability from RLS-scoped profiles.
- **Warehouse/Delivery:** click equipment to open the 3D explorer, or select a load with an assigned unit.

## Make, model and year integration
Current production `at_vehicles` has `unit_number, vehicle_type, required_license_class, payload_capacity_lbs, enabled` but **no** `make,model,model_year` fields. An additive **review-only** SQL migration is provided at `supabase/sql/vehicle_make_model_metadata_review.sql`. Do **not** apply without explicit approval.
- The existing production `LiveWorkspace` inventory query remains unchanged and safe before migration.
- A separate optional RLS-scoped metadata query reads make/model/year/paint only if the schema supports it; absence/denial is tolerated and the session stops probing after the first error.
- The UI only displays a named real make/model **if those fields were provided by actual inventory**. Otherwise it says "Manufacturer/model not recorded" and identifies the generic rendered body.
- Sample-mode fleet explicitly includes fictional make/model values for Volvo VNL 760, Ford Transit, Freightliner M2, Ram 3500 and Mercedes-Benz Sprinter.
- Inventory metadata is not editable through the public demo or driver workspace; the database migration by itself does not change RLS policies or create new write permissions.

## Security / operations
- No role escalation; warehouse, delivery and dispatch wide views are restricted to existing admin/dispatcher roles or sample demo. Actual driver view filters to the authenticated user as before.
- Server RPCs for FIFO allocation, status progression, ePOD and proof capture are untouched. Selecting vehicles or visual colors is **display-only**.
- Supabase continues to enforce RLS, organization scoping, existing pagination caps and session authorization. Optional make/model read does not use service-role keys.
- No maintenance scores, unverified dock loading, sales revenue or messaging events are synthesized as production data.
- The new UI is on a review branch only; production is unchanged unless PR is deliberately merged and any optional migration is separately approved.

## Release gates
1. `npm test` and `npm run build` pass, including new driver ownership, model truthfulness, warehouse counts and delivery histogram tests.
2. Vercel preview READY for latest PR commit, production remains on main.
3. Manual browser checks: GPU/WebGL/fallback on Chrome/Safari/Firefox, drag orbit, touch, reduced-motion, color controls, dropdowns, responsive 360px mobile through desktop, user permission/visibility, scroll containers, shipment selector and modal close.
4. Signed-in driver test: never show another driver's assigned equipment; dispatcher can view only their organization.
5. Migration SQL reviewed and applied separately before adding real inventory make/model data.
6. For photorealistic **exact** Volvo/Freightliner/Kenworth digital twins, obtain properly licensed per-model glTF/GLB files, map by validated manufacturer/model/year and run a separate review for size, license and IP compliance.

- The sample dashboard opens on the brighter Delivery Overview by default to show the user-requested design; authenticated production landing remains on the existing overview to avoid surprising active operations.
