# ARCVIEW HUD — cinematic Driver Cockpit visual layer

## Purpose
Original, Iron Man–inspired holographic telemetry for Andertrack. No movie assets, logos, characters, licensed soundtrack, proprietary HUD artwork or external third-party animation packages are used. Only React + SVG + CSS is needed.

## Interaction and layout
- Circular central **arc-core** with three animated counter-rotating telemetry rings, radial ticks, numeric speed report and track fill.
- Responsive peripheral telemetry panels with unit, GPS freshness/accuracy, optional battery level, heading, latitude/longitude and mission assignment reference.
- Decoratively rotating radar sweep and target reticle, subtle signal bars and central hologram scanning beam.
- **Hide HUD / Show HUD**, **Compact / Expand**, and **Pause / Resume motion** controls. Motion toggles operate through state, not fake buttons.
- Fluid mobile display and narrower compact layout. Expensive operations are avoided: no canvas engine, no third-party animation library and no requestAnimationFrame loop. Effects are CSS transform/opacity.

## Security, data provenance and safe-driving behavior
- **Demo** is explicitly labeled **SYNTHETIC DEMO** and only draws existing sample profile/vehicle telemetry.
- **Live driver** uses only their existing RLS-scoped current GPS data and currently assigned shipment. Missing/stale/unapproved data appears as **GPS UNAVAILABLE**, speed/heading **--** and **no coordinates**; it never uses sample values.
- Live admins/dispatchers are not granted a driver cockpit position just because they have other fleet data. Component is locked for non-drivers outside demo.
- All HOS and health values display **NOT CONNECTED** in live mode, rather than invented numbers; animation does not imply certified fatigue detection, navigation, ETA, speed-limit or regulatory status.
- CSS motion defaults **off** for live use. Decorated motion automatically stops if recent GPS reports vehicle speed **over 5 mph**, when the page loses visibility, when HUD is hidden, when user pauses, or when `prefers-reduced-motion: reduce`. Live-driving interaction should remain minimal; this is not an approved heads-up display for windshield use.
- No new persistent data storage, background GPS collection, location permissions, third-party calls, database policies, authenticated credentials, payment or payroll effects.
- Copy names **ARCVIEW** / **Andertrack** identify original art rather than Marvel/IP branding.

## QA
- Unit tests verify fresh/stale/future/invalid GPS, demo distinction, speed/heading source, degrees, motion safety lock, privacy-scoped mission reference.
- GitHub Actions: `npm test` and `npm run build` must pass. Vercel preview must be READY.
- Browser QA needed: Firefox/Chrome/Safari mobile, dark and light themes, screen reader labels, reduced motion, visibility pause, compact/expanded, demo driver switching, stale GPS and actual driver no GPS, live moving vehicle lock.
- Do not merge to production before preview review and browser checks.
