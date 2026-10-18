# Northvale user-supplied React prototype — Andertrack integration

## Source and adaptation
The source is the uploaded 2,268-line `Pasted text.txt` containing a standalone React `NorthvaleClassCDashboard`. It contains six mock vehicle records, five mock alerts, eight workshop planner events, twelve forecast months, a vehicle illustration, a top-down diagram with clickable hotspot pins, an interactive service modal, and an on/off "Pre-Trip DVIR Signed" button.

**Do not paste the source unchanged into live Andertrack.** It uses its own navigation, standalone fake data, custom Northvale wordmark, flat SVG instead of Andertrack's actual Three.js viewer, and a dangerous DVIR toggle that marks a record "signed" without authenticating, saving, auditing or verifying a legally meaningful inspection. Its documents dialog claims central fleet sync but does not actually implement any integration.

## Integrated changes
- The existing **Class C Fleet** four-tab experience remains the sole route. The existing Three.js viewer and Leaflet/Class C GPS view remain intact.
- **Demo Dashboard & Vehicles:** the uploaded six fictional sample vehicles (Prado TRK-104, Hilux TRK-107, Hiace VAN-021, Hilux TRK-115, Coaster BUS-150, Land Cruiser TRK-201) now appear in the vehicle showroom and interactive Quick Fleet Overview. The condition and driver/route labels are fictional and must not populate real company inventory.
- **Demo Analytics:** a keyed vehicle inspector shows clickable, keyboard-operable hotspot pins over the existing top-down diagram, with the uploaded mock severity readings for each vehicle. The inspector also switches six example subsystem readings by vehicle and explicitly says these are synthetic, not a diagnosis.
- **Demo Forecast:** a twelve-month cost curve uses the user's sample values (June $4,592 actual and $5,100 forecast). Hover, click, and keyboard focus inspect each month; chart and text mark financials as synthetic even for months later in the year.
- **Demo Alerts and Schedule:** five reference alerts and eight weekly workshop allocations replace the narrower earlier example feed. New service items still use locally validated, removable drafts.
- Real live operational fleet totals are unaffected. Mechanical diagnostic streams, sensor health, service cost invoices, work orders, payroll, signed DVIR forms and driver documents remain **NOT CONNECTED** until implemented through separately reviewed authenticated, audited backends.
- The existing Class C location map, driver-only GPS authorization, safe routing links, GVWR warnings, and Driver Cockpit shift ribbon are retained.

## Safety and governance
- No new Vercel/Supabase environment variables, client secrets, database migrations or writes.
- RLS restrictions stay unchanged.
- **DVIR remains an explicitly unsubmitted downloaded draft.** It cannot be represented as signed, synced or accepted by maintenance until an actual verified submission/acknowledgement process exists.
- The included Coaster bus is a fictional UI record. Neither a vehicle-type string nor GVWR alone proves non-CDL qualification; passenger capacity, operation type, combined ratings and jurisdiction matter.
- This PR is review-only and should not be automatically merged into production without browser/mobile inspection and an approved preview.

## QA
- `npm test`, `npm run build`, then manual keyboard/touch testing on the rendered dashboard, mock-to-live state isolation, 3D switch, maps, twelve-point chart, inspector, service draft, and DVIR flow.
- Tests in `tests/northvale-reference-demo.test.mjs` check six catalog identities, pin positions, the twelve source forecast months, sample alerts/workshops.
