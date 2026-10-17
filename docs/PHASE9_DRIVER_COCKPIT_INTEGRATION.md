# Andertrack Phase 9 — Driver Cockpit & HOS (integration-safe prototype)

## Implementation
Adds `Driver Cockpit & HOS` navigation in the current Ops Command Center and new standalone `DriverCockpit.jsx`. It intentionally does not replace `App.jsx`, because that file is the **sample-data entrypoint**, while authenticated fleet/driver data and the nav live in `LiveWorkspace.jsx` and `OpsCommandCenter.jsx`. This prevents overwriting the active Command Center, Smart Operations, Phase 4 proof workflow and the Phase 8 Dispatch Decision Studio.

## Demonstration features — no real telemetry, money or health records
Three **explicitly synthetic** profiles provided by the user:
- Jameson Doe — Class A cold-chain, illustrative HOS, log, trip costs, IFTA, biometrics.
- Oliver Smith — Local metro EV delivery, illustrative shift log, stop pay and tips.
- Michael R. — Class A intermodal, illustrative HOS, log, trip costs, IFTA and biometrics.

The demonstration has a duty-state switch (OFF / SLEEPER / DRIVE / ON), 24-hour 15-minute-grid rendering, hour-reference gauges (11-hour driving, 14-hour duty window, 8-hour driving interval, 70-hour cycle), sample slider and ECG-style illustration. These are **noncertified illustrations**, not actual FMCSA ELD calculations, rest-break adjudications, DVIRs or legal records. HOS rules depend on duty periods, restart/sleeper provisions, exceptions, prior logs, cycle resets and applicable regulations.

The demo wallet shows fictitious daily/weekly earnings, tips, detention, bonus and stops. **Simulate instant cash out** changes only an on-screen status message. No money is transferred, no authenticated payment API is called. **Simulate drop** adds $15 only to the local sample wallet and a screen message; no shipment mutation, ePOD evidence or payroll entry is created.

The demo mileage/IFTA shows sample miles by state, loaded and deadhead split and example odometer. It is **not** derived from real GPS, geofence crossings or certified IFTA fuel/mileage ledger. Biometric BPM, SpO2, alertness and safety-score examples are not from wearable devices and are **not medical data**. The waveform is decorative/synthetic. Consent, retention, occupational data governance and device integration need review before any real wellness features.

The example map is only a read-only point marker. No integrated turn-by-turn routing, speed-limit feeds, PrePass validation, HOS-aware routing or autonomous location recording. An explicit link opens the assigned destination in third-party Google Maps at the user's request. Third-party directions are not necessarily suitable for commercial vehicles.

## Actual authenticated functionality
- Live page is role aware; `driver` sees only loads whose `driver_user_id` is their own authenticated ID. Table RLS remains the ultimate security authority. `admin`/`dispatcher` do not impersonate drivers, see fabricated private payroll data or submit driver proofs through this page.
- Existing protected `AssignmentActions` allows owner-only accept / decline / status advance through server validated RPCs.
- Existing `DeliveryWorkflow` allows authorized assigned drivers to scan courier packages and capture a recipient name, required private photo and optional notes via validated `at_scan_package` and `at_confirm_delivery` RPCs.
- Live ePOD and queue functions retain Supabase RLS and protected private evidence. No extra database tables, secret keys, authenticated OAuth integrations, APIs, payout writes or redirects.
- Current login/session/auth issues, SMTP rate limits and staging provider configuration are separate and not changed by this branch.
- Real driver's current location is not readable via existing dispatcher-only GPS policy; live driver map shows honest absent/authorized state rather than revealing another tenant's GPS.
- No payslip, gate code, manual telematics, IFTA ledger, certified ELD or health sensor input exists. Live panels display "Not connected" instead of sample measurements.

## Release quality gates
1. `npm test` and `npm run build`; Vercel preview READY.
2. UI review: mobile and desktop, light/dark theme, nav and command-palette navigation, demo profile switching and all interactive illustration controls.
3. Real driver browser test: invited `driver` role with a profile/license verification and an assigned in-transit load, test valid package manifest and private photo proof. Test other-driver org isolation and no admin impersonation.
4. ELD vendor selection (certified and tested), applicable HOS/ruleset policy, audit/signing correction handling and downtime/transfer protocols **before** real HOS clocks.
5. Payroll ledger + payouts platform, KYC/authorization, customer tips reconciliation, failure recovery and legal compliance **before** instant cashout.
6. IFTA telematics mileage, fuel purchase records, jurisdiction crossing history, device calibration and retention **before** IFTA reports.
7. Medical/biometric collection policy, user consent and verified devices **before** enabling personal vitals.
8. Commercial vehicle routing provider and driver-safe UX before "turn-by-turn" claims.

## Security release
This is a reviewable draft PR. No migrations or side effects on production. Avoid merging into live until staging authenticated E2E, safety and privacy review are complete.
