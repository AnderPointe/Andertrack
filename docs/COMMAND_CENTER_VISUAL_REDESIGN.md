# Andertrack command center — design refresh

## Direction
Adapted from user-supplied fleet dashboards, dark tracking workspaces, map-first shipment panels, light analytical cards, and warehouse-digital-twin inspiration. Rebuilt as original Andertrack UI rather than reproducing third-party screens.

Palette: carbon black, orange for actions/priority, teal for live telemetry/operational success, white for readable hierarchy.

## Functional scope
- New premium sign-in and explicitly marked interactive demo, no live database access in demo mode.
- New overview, interactive map, real count-only KPIs, operational snapshot donut, shipment status filters.
- Live tracking from RLS-scoped `driver_location_current`, GPS markers only from real positions. Demo uses clearly labeled sample records.
- Dispatch center retains Phase 5 FIFO queue with original authorized RPCs; assignment details preserve original Phase 3 server-enforced offer/accept workflow.
- Driver/fleet directory, actual created-at seven-day activity chart and security/settings panel.
- Sidebar navigation works on desktop/mobile, search filters shipment list, dark/light appearance switch, loading/realtime status and graceful empty states.
- New `leaflet` dependency for an interactive map with OpenStreetMap pilot tile service.

## Security / truthfulness
- No backend schema modifications in this UI branch.
- No geolocation, earnings, fuel or driver compliance numbers are fabricated in authenticated mode.
- Query read access uses existing organization RLS, with GPS limited to authorized dispatcher queries.
- Backend RPCs remain the sole mutation path; driver and dispatch privileges are not granted by frontend.
- Demo actions never invoke Supabase. Demo source records are illustrative only.
- Browser-side Vite uses existing publishable Supabase credentials; no secret server keys in code.

## Release gates
- GitHub CI and Vercel preview build must succeed.
- Test desktop/mobile navigation and both visual themes.
- Test map loading and terms/performance of third-party tile provider. For production scale, move to a contracted tile service or self-hosted tiles; public OpenStreetMap standard tiles are not an SLA.
- Browser E2E: sign-in, tenant isolation, dispatch queue, driver actions, map current position, RLS errors and sign-out.
- Current staging project has no Auth users; use sample demo mode for UI review. Do not enable public signups for this.
- Do not merge until approved; production Vercel and Supabase should remain untouched by this feature branch.
