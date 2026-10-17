# ARCVIEW Immersive — Full-screen Cinematic Driver Cockpit

## Implemented
- Launch **Enter Cinematic Cockpit** from the existing Driver Cockpit & HOS, below the ARCVIEW HUD.
- Full-screen browser API with a CSS fixed-position immersive fallback; **Exit cockpit** and Escape return to the normal dashboard.
- Three original holographic layers: **Holographic map**, **Vehicle diagnostics**, **Mission intelligence**.
- Read-only, larger Leaflet + OpenStreetMap map with teal reticle, telemetry overlays and GPS position. If current RLS-authorized device coordinates are absent/stale, no live location or fake route is drawn.
- Live driver readouts for current GPS, reported speed, heading, device battery, accuracy and signal strength where supplied by the existing authorized feed. Engine diagnostics, cabin sensors and certified ELD are explicitly **NOT CONNECTED**.
- Read-only mission details: reference, shipment state, pickup, drop-off, commodity and scheduled delivery from the signed-in driver's previously authorized assignments. Does **not** navigate or change a load.
- Holographic line graphics and subtle motion (CSS-only) with motion pause.
- **Command Bridge:** command chips and typed commands; opt-in push-to-talk Web Speech API when supported. Speech is not always on, no transcripts stored or sent to Andertrack servers, and the browser's speech engine may process audio externally. Explicit whitelisted commands: show map, diagnostics, mission, center map, pause/resume effects, help, exit.
- No VAD activation word / no always-on assistant. Unrecognized commands fail closed; no remote control of HOS, payout, truck electronics, shipments, alerts or navigation.
- Explicit sample-demo treatment; live mode never imports sample speed or coordinates.

## Driver distraction and permissions
- **Fail-safe visual/voice lock:** decorative motion, map input, tabs, typed commands and microphone are enabled in demo, or for real drivers only when **fresh authorized GPS explicitly reports speed between 0 and 5 mph**. If GPS is absent, stale or speed unavailable, interactive controls stay locked (apart from exiting); this does *not* guarantee driving safety or confirm the vehicle is physically parked.
- No continuous microphones; a user-initiated push-to-talk recognition session stops on microphone error, completion, page hiding, closing cockpit, or loss of stationary permission. Browser permission prompts apply.
- User preference `prefers-reduced-motion: reduce` disables decorative animations. Hidden tabs and active motion disable them too.
- Only drivers' RLS-scoped locations and assignments reach live mode. Admin/dispatcher cannot impersonate a driver via this screen.
- The product is **not** a windshield HUD, certified navigation, ELD, fatigue detector, medical telemetry, truck-safe router or speed-limit service. Do not interact while driving.
- No new backend writes, Supabase migrations, policy changes, third-party APIs beyond existing map tile requests and optional browser speech recognition, or secret keys. OpenStreetMap public tiles remain a pilot-only option without a commercial SLA.

## QA gates
1. GitHub `npm test` and `npm run build` succeed; Vercel preview is READY.
2. Manually verify browser Fullscreen API on desktop and CSS fallback where denied; Escape closes; page scroll restores; no stale overlay persists.
3. Map centering and zoom on demo, authorized live GPS, GPS missing, stale, future-dated, and cross-tenant permission-denied scenarios.
4. Verify microphone permission rejection, unsupported browsers (Firefox included), typed fallback, no continuously active mic, and forced stop when state changes.
5. Confirm stationary-state movement lock, hidden document pause, OS reduced-motion preference, mobile landscape/portrait and keyboard.
6. Verify role/auth separation with test driver and admin accounts. No certified regulatory or payroll values are created.
7. Only merge after preview approval and authenticated in-browser QA.
