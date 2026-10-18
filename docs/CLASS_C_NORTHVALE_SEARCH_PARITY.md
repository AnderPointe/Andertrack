# Northvale source re-upload — Class C navigation parity

## Source
User-provided `Pasted text(2).txt` (~2,296 lines, titled `NorthvaleClassCDashboard.jsx`) describes four standalone React tabs, an upper search and alerts bar, six synthetic Class C vehicles, a selected-driver ribbon, video-style hotspot data and simulated maintenance controls.

The substantive Northvale prototype features are **already incorporated** in `src/features/live/ClassCOpsDashboard.jsx`, `src/lib/northvale-reference-demo.js`, the existing Three.js vehicle inspector and authenticated Class C GPS/maintenance workflows. Duplicating its entire code or replacing the production `App.jsx` would conflict with organization permissions and mix mock and real fleet records.

## New adaptation
- **Header search:** a persistent Northvale-style search pill matches unit number, manufacturer, model, assigned driver and recorded pickup/drop-off addresses against the **already-authorized** Class C inventory. Demo mode also searches fictional driver, route and condition. Search does not trigger extra database queries or expose other-tenant data.
- **Alerts navigation:** a button opens the existing Vehicles & Recent Alerts workspace. It does not show a fake production alert count or fabricate real-time sensor feeds.
- **Cross-panel sample driver ribbon:** selecting a different mock Northvale vehicle updates the shown demo driver's name, route, completed/total stops and sample earnings using the *selected vehicle's own synthetic fields*, rather than one fixed Hiace profile.
- **Search count and clear:** shows filtered/available unit counts and a direct clear option. The filter affects vehicle display/search, not life-safety reports or service orders. Staging/production credentials and tables unchanged.
- Responsive styling and unit/driver/route search regression tests.

## Safeguards
- **Do not reuse the original `dvirVerified` toggle**: toggling a button alone cannot legally sign a DVIR. Retain the existing driver-attested server RPC or explicit unsubmitted draft fallback.
- **Do not reproduce the file's "synced with your central fleet database" statement**: the uploaded demo doesn't implement document synchronization.
- Do not label source values (128 vehicles, 28 critical alerts, sample finances, fictional GVWR) as live telematics. Real HOS, payroll, tip, diagnostic and service ledger features require separately verified connections.
- All live search fields come only from RLS-scoped `classCOpsRecords` results.
- **Review-only branch:** release requires CI and UI QA, Vercel preview of latest revision, organization role smoke tests. No production database migration or site release here.
