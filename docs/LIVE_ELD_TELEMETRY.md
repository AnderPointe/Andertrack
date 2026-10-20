# Live ELD telemetry with Vector

`services/telemetry/vector.toml` replaces the Node collector. It uses Vector
0.49.0, authenticated HTTP ingress, strict numeric/range checks, private Supabase
Broadcast envelopes, and a batched PostGIS ingestion RPC matching Andertrack's
existing organization-scoped `at_vehicles` inventory. It does not write a generic
`vehicles` table or overwrite driver GPS tables.

## Activation (not performed)

1. Review and apply `supabase/sql/live_eld_telemetry_review.sql` in **staging**.
   The one-time review script expects tenant tables and PostGIS in `extensions`.
   Adapt qualified types/functions if PostGIS is installed elsewhere. Validate
   PointZ persistence, duplicate truck keys in a batch, and older-write rejection.
2. Audit existing `realtime.messages` policies: permissive policies OR together.
   Remove broad policies allowing telemetry reads or client-spoofed broadcasts.
   In Supabase Dashboard → Project → Realtime → Settings disable **Allow public
   access**, after checking effects on existing channels. Verify anonymous users,
   drivers and other tenants cannot read/join; own-tenant planners can.
3. Host Vector on an always-on container/VM, not in the Vercel frontend. Build:
   `docker build -t andertrack-telemetry services/telemetry`.
   Mount a persistent writable volume at `/var/lib/vector`. Inject through the
   host secret manager, never Git or `VITE_*` variables:
   - `SUPABASE_URL=https://whzihzqtyfagxgysbaod.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: matching server-only service-role key
   - `TELEMETRY_ORGANIZATION_ID`: lowercase UUID of the trusted organization
   - `TELEMETRY_INGEST_TOKEN`: strong random secret, at least 32 characters
4. Put a TLS reverse proxy in front of port 8080. Restrict ingress to trusted
   gateways, limit request bodies to 16 KiB, rate-limit requests/connections and
   enforce timeouts. Basic auth is safe only over HTTPS. The proxy must not log
   authorization headers or telemetry payloads.
5. Before deployment run, with these variables supplied securely:
   `vector validate --no-environment services/telemetry/vector.toml` and
   `vector test services/telemetry/vector.toml`. `sh services/telemetry/check.sh` runs these
   offline checks using non-secret test values when Vector is installed. Also exercise both HTTP sinks
   against staging: transform tests do not prove live auth, RLS or wire behavior.
6. Set frontend `VITE_SUPABASE_URL` and the matching
   `VITE_SUPABASE_PUBLISHABLE_KEY` for the intended environments. Enable
   `VITE_ELD_TELEMETRY_ENABLED=true` only after staging checks, then rebuild.
   URL/key changes alone do not apply SQL or start Vector.

## HTTP input

POST `/telemetry` with JSON and **Basic authentication** (username `telemetry`,
password from `TELEMETRY_INGEST_TOKEN`). This replaces the Node collector's
Bearer ingress contract; update gateway authentication accordingly.

```json
{"truck_id":"TRK-018","speed_kmh":72.5,"fuel_pct":64,"odometer_km":183420.2,"lon":-74.0,"lat":40.7,"alt":12}
```

Send one object per request, approximately once per second per unit. Numbers
must be JSON numbers. Altitude defaults to zero. The device cannot choose the
organization, driver identity, WKT or timestamp. `updated_at` is receipt time;
do not replay historical samples as current positions. Invalid transform events
are dropped; a successful HTTP source response is not proof of valid telemetry
or successful delivery to both sinks. Monitor Vector's internal component errors
and discarded events. MQTT/ELD vendors require an MQTT-to-HTTP gateway; this is
not an MQTT broker or a vendor-specific ELD adapter.

## Sink semantics and limitations

- Broadcast sends one properly wrapped `messages` object per HTTP request, with
  `private=true`, topic `telemetry:<organization UUID>` and event `telemetry`.
  Input cadence drives animation updates; no synthetic 1 Hz ticks or new 3D
  interpolation are introduced. Its bounded memory buffer blocks when full.
- State uses comma-delimited JSON inside an explicit RPC object with `p_ticks`
  array, up to 50 ticks per batch or a 10-second timeout (not a guaranteed exact
  10-second interval). The SQL deduplicates repeated truck IDs, choosing the
  newest receipt timestamp, then resolves existing enabled inventory and builds
  PostGIS PointZ. Equal timestamp ties have no guaranteed ordering.
- A 512 MiB disk buffer retains pending state on the mounted volume across
  restarts, subject to Vector's synchronization window. Acknowledgements are not
  enabled: ingress success is not a durable or end-to-end sink acknowledgement.
  Retryable HTTP failures are retried; permanent errors (including bad SQL,
  credentials or unknown/disabled inventory) can discard batches. Monitor errors
  and test upstream retry/outbox behavior; this is not a lossless guarantee.
- Unlike the old Node collector, Vector does not query inventory before Broadcast.
  Only trusted gateways should send fleet data. Unknown trucks may be broadcast
  but are ignored by the frontend inventory association and rejected by SQL.
  One unknown/disabled unit can reject its entire batch. Validate unit provisioning
  upstream and test this failure mode before enabling production.
- The sinks are independent, not transactional. One can succeed while the other
  fails. Retries can duplicate Broadcasts. Use one instance per tenant and test
  capacity and backpressure under load. Historical state is not stored.
- Private channel hydration/reconnect and 30-second polling recover persisted
  latest state. Map association requires verified inventory and an unambiguous
  active driver assignment. Drivers retain the existing self-only GPS path;
  unassigned trucks do not become driver markers. Fuel/odometer are persisted,
  not invented HUD values.

References: [Vector HTTP sink](https://vector.dev/docs/reference/configuration/sinks/http/),
[HTTP source](https://vector.dev/docs/reference/configuration/sources/http_server/),
[Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast),
[private channel authorization](https://supabase.com/docs/guides/realtime/authorization).
