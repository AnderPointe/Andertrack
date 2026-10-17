# Post-launch stability patch — Andertrack Command Center V2.1

Scope: frontend React/Supabase data-loading/Leaflet only. No database migrations, DNS or production environment changes.

## Improvements
- Position validation: reject absent, nonfinite, out-of-range coordinates. Current/online status requires an actual parseable timestamp within five minutes, never a future timestamp.
- Preserve map pan/zoom while live GPS rows refresh; auto-fit only upon first valid location for a mounted map.
- Reset map extent when switching organizations by providing a tenant-scope component key.
- Shipments: global filters and search use one shared filter helper; detail selection follows the currently visible list instead of pointing to a hidden load.
- Auth: handle session-check rejection so login cannot stay forever on "Checking session"; handle network errors requesting magic links; normalize submitted email.
- Membership: show "Checking workspace access" while membership is loading, rather than incorrectly indicating pending organization access.
- Realtime: batch Postgres change events over a short debounce, avoid concurrent out-of-order responses overwriting current data, refresh on reconnect/tab visibility, retain periodic visible-tab polling fallback, clean up listeners on unmount.
- Sent magic link screen: confirm which address was entered and allow changing it without automatically triggering another OTP (reduces rate-limited requests).
- CI: new Node native unit tests for GPS validity/freshness, assignment filters and selection; run tests before Vite build.

## Validation and remaining gates
- GitHub Actions and Vercel preview builds must pass.
- Perform browser-level authentication, live WebSocket, cross-organization switching, and narrow viewport regression tests. No testing account is provisioned in staging.
- Public OSM tile service remains a pilot map dependency; migrate to an SLA-backed provider before high-volume production.
- Review production Supabase Security Advisor findings separately (database configuration is out of scope).

No frontend client is granted extra backend privileges.
