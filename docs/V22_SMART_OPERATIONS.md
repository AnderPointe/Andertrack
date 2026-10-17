# Andertrack V2.2 — Smart Operations Center

## Goals
Improve real operational throughput, keyboard workflow and explainable exception handling. This is not a predictive-AI or automated dispatch decision-maker.

## Built features
- New **Smart Operations** workspace page and overview intelligence panel.
- Notification drawer with real exception counts, priority badges, one-click routing to dispatch/tracking/fleet and local **Snooze 30m** actions.
- Explainable alerts derived only from existing RLS-scoped Supabase records:
  * Requests waiting >=15m (high at >=30m).
  * Loads still unassigned >=60m after creation.
  * Driver marked available but license verification pending.
  * Invalid/missing GPS coordinates for a reported fleet row.
  * Stale GPS positions >=10m (high at >=60m). Does **not** state the truck is offline.
- **Recent Activity** feed composed from queue request times, shipment creation and reported GPS timestamps (not inferred delivery events).
- **Command palette** via Ctrl/Cmd+K, searchable pages and authorized loads/drivers, keyboard arrows, Enter, Escape.
- **CSV export** of the currently filtered, visible shipment rows. CSV cells protect against spreadsheet formula injection.
- Demo mode continues to show its labeled sample records; no writes in preview mode.
- Persisted 30-minute alert snooze state saved only in local browser storage, keyed by organization. Underlying database records remain untouched.

## Data protections
- All exception calculations run client-side on records already selected under RLS. No new tables, security policies, backend RPCs or keys are needed.
- Role-aware alerts: drivers only see their queued requests. Organization dispatch exceptions are reserved for admin/dispatcher users.
- Search never queries other tenants. It uses only already loaded, authorized records.
- The alert system gives review suggestions and is **not** a safety or compliance certification; queue thresholds are configurable pilot heuristics, not organization policy.
- Empty records produce empty alerts; no invented predictions.

## QA
- Node regression tests for severity thresholds, role segregation, source timestamps, no-data behavior and CSV escaping.
- GitHub Actions: npm test, then Vite production build.
- Vercel preview: responsive view, alert drawer, command keyboard interactions, in-browser export and map behavior.
- Browser E2E with authenticated roles, mobile viewport and live location remain outstanding pending test accounts / preview access.

**Do not merge before build tests and visual verification.** Production DB and DNS untouched by this feature branch.
