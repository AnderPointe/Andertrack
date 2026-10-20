# Live ELD telemetry

This implements the supplied HTTP → sanitize → private Broadcast + 10-second
state-upsert pipeline using a dependency-free Node 22 collector rather than
pasting the Vector configuration unchanged. Andertrack uses `at_vehicles` with
organization-scoped `unit_number` values, not a global `vehicles.truck_id` table.
The collector sends proper Broadcast `messages` envelopes and batches to an RPC
that resolves existing inventory and builds PostGIS PointZ geometry. It never
creates vehicles or overwrites driver GPS tables.

## Deployment (not performed by this PR)

1. Review `supabase/sql/live_eld_telemetry_review.sql` and apply in **staging**.
   It expects the existing tenant schema and PostGIS in the `extensions` schema.
   If PostGIS is installed elsewhere, adjust the qualified type/functions first.
   This review script is one-time, not an automatically applied migration.
2. Review all existing policies on `realtime.messages`: permissive policies OR
   together, so remove any broad policies that bypass the fleet membership rule.
   In Supabase Dashboard → Project → Realtime → Settings disable **Allow public
   access**. Verify existing channels before changing that project-wide setting.
   Verify another tenant, drivers and anonymous clients cannot read telemetry or
   join its channel; planners may read their own organization only. Authenticated
   clients must not have an INSERT policy permitting spoofed telemetry broadcasts.
3. Run the collector on an always-on container/VM, **not as a Vercel function**.
   Build with `docker build -t andertrack-telemetry services/telemetry` or run
   `node services/telemetry/server.mjs` with Node 22. Inject these environment
   variables through the host's secret manager (never a frontend `.env`):
   - `SUPABASE_URL`: the backend project HTTPS URL
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key
   - `TELEMETRY_ORGANIZATION_ID`: one trusted organization UUID per collector
   - `TELEMETRY_INGEST_TOKEN`: separate random bearer token, at least 32 characters
   - `PORT`: optional, defaults to 8080
4. Terminate TLS in a trusted reverse proxy; restrict ingress to authorized
   gateways and enforce request/rate/connection limits. Do not expose port 8080
   publicly without TLS. Rotate both secrets using the hosting secret manager.
5. Set `VITE_ELD_TELEMETRY_ENABLED=true` for the Andertrack frontend only after
   the schema/security checks pass, then rebuild. Default is off, so an unapplied
   schema does not affect existing production. No service-role key belongs in a
   `VITE_*` variable. Planners subscribe to private `telemetry:<organization UUID>`
   channels; drivers retain the existing self-only GPS path. State hydrates on
   connect/reconnect and every 30 seconds as fallback.

## Input contract

POST `/telemetry`, `Content-Type: application/json`, `Authorization: Bearer <ingest token>`.
One object per request; send approximately once per second per unit:

```json
{"truck_id":"TRK-018","speed_kmh":72.5,"fuel_pct":64,"odometer_km":183420.2,"lon":-74.0,"lat":40.7,"alt":12}
```

All measurements must be JSON numbers. Coordinates, speed, fuel and odometer are
required and range-checked. Altitude defaults to zero. `truck_id` must match an
existing enabled vehicle's `unit_number` in the collector's fixed organization.
Device organization/driver IDs, WKT and timestamps are ignored. `updated_at` is
collector receipt time; gateways should not replay old samples as current data.
MQTT/ELD vendors need a gateway forwarding this HTTP contract; this is not an MQTT
broker or a vendor-specific ELD adapter.

## Behavior and limits

- Broadcast follows each accepted input; it does not manufacture 1 Hz ticks.
  Private Broadcast is ephemeral; disconnected clients recover latest persisted
  state, not every animation frame. This feeds existing map position rendering,
  not new interpolation/3D animation logic.
- Latest state is coalesced per truck, at most 50 distinct trucks per 10-second
  flush. SQL rejects unknown/disabled inventory and older writes cannot overwrite
  newer state. A failed batch is retained and retried every 10 seconds. Inventory
  deletion/disabling during a pending batch can block it; drain before disabling
  and alert operators on repeated flush failures. No history table is introduced.
- Buffer is bounded to 1,000 trucks and 50 concurrent requests, in memory only.
  A 202 means queued, **not durably persisted**. Process failure can lose pending
  ticks; production lossless ingestion needs a durable queue/outbox upstream.
  Gateways must back off/retry 503s; the two sinks are not transactional and
  retries may produce duplicate broadcasts. Use a single collector per tenant
  to preserve receipt order. For sustained >50 distinct trucks / 10 seconds,
  increase capacity deliberately or partition collectors and test throughput.
- Map association requires verified inventory and exactly one active assigned
  driver. No driver is inferred from device-supplied identity. Existing freshness
  checks still hide stale positions. Unassigned trucks persist but are not shown
  as driver markers. Fuel/odometer persist for future UI; no invented HUD values.

References: [Broadcast envelope](https://supabase.com/docs/guides/realtime/broadcast),
[private channel authorization](https://supabase.com/docs/guides/realtime/authorization).
