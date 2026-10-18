# Phase 10 — Fleet Safety Interlocks (review only)

## Handoff / current scope
Phase 9 introduced attested driver defect submissions, authenticated dispatcher work orders,
append-only safety audit events, and a staging-tested schema. The staging validation PR
#26 remains a separate approval step. PR #28 merged the Northvale Class C search/GPS fixes.
No automatic production safety certification or maintenance clearance exists.

This phase adds an **authoritative database hold against offering or accepting an
unsafe vehicle** and a **read-only, fail-closed dispatcher scenario screen**. It is not
an automatic ELD, certified electronic DVIR signing, qualified mechanic release,
FMCSA compliance determination or an automatic dispatch cancellation system.

## Database safety boundary — REVIEW ONLY
File: `supabase/sql/phase10_dispatch_safety_interlock_review.sql`.

Prerequisite: Phase 9 schema (`at_vehicle_dvir_reports`, `at_vehicle_service_orders`,
`at_vehicle_safety_events`) installed and reviewed in the target environment.

- A private SECURITY DEFINER **trigger**, inaccessible directly to Data API clients,
  runs before new assignment offers, FIFO claims (which create offers), and acceptance,
  and before forward movement through active shipment statuses or equipment reassignment. It rejects the attempt when a vehicle
  has any nonclosed, `out-of-service` driver-reported defect in its organization.
- Severe defect submission and dispatch candidate changes lock the same equipment
  row, serializing the check with a concurrent new OOS report.
- The trigger does not silently cancel already accepted/in-progress loads when
  a new severe defect is reported. A subsequent forward status transition is blocked by the trigger, but dispatch must contact the driver, hold operation,
  and document incident-specific disposition under company procedures.
- An existing **administratively closed** report is not a professional mechanic
  certification or roadworthiness decision. Safety/compliance must define a separate
  release-to-service control before claiming regulatory compliance.
- A separate SECURITY INVOKER, planner-only RPC returns organization-scoped unit
  counts of open severe defects. It is a **snapshot**, not permission to dispatch.
  Existing RLS and role checks still apply; direct client safety-table writes stay revoked.

The trigger is the authorization boundary once approved and installed. Frontend UI
filters are supplemental; no caller can bypass the trigger by directly invoking the
existing `at_offer_assignment`/`at_claim_next_dispatch` or acceptance RPCs.

## Dispatch Decision Studio
- Loads safety evidence through `at_dispatch_vehicle_safety_status` scoped to the
  active organization. Snapshots refresh about every 45 seconds.
- Screened units with any open OOS reports cannot appear as recommended candidates.
- Missing backend, failed auth, stale (>60 seconds), malformed/duplicate results,
  cross-tenant evidence or units missing from a truncated response all fail closed.
- Existing FIFO, license, weight/capacity and GPS checks still apply.
- Demo mode remains explicitly synthetic and does not assert real hold clearance.
- The studio remains read-only; no new auto-assignment action was added.

## Mandatory QA and deployment order
1. Keep PR **draft**. Review migration, trigger transitions, deadlock/concurrency
   implications, operational duty-of-care, and DVIR administrative-close meaning
   with a safety/compliance owner and DB reviewer.
2. Run `npm test` and `npm run build` in CI, inspect final Vercel preview on
   desktop/mobile, and test expired/missing safety snapshot UI states.
3. Install Phase 9 staging schema if not present, then Phase 10 migration **in staging
   only with explicit authorization**. No migration is applied by this PR.
4. Use two organization tenants and authenticated dispatcher/driver accounts to
   attempt direct RPC offer, FIFO claim, acceptance, cross-org read and unsafe
   vehicle reassignment. Ensure every OOS attempt fails, no queue is skipped
   or silently consumed, and safe equipment remains eligible.
5. Race-test OOS submission concurrent with offer/accept; exercise trigger
   under locking and service-order closure; inspect DB advisers and privileges.
   Verify that the audit trail remains append-only.
6. Rehearse response to an OOS report filed **after** an assignment is accepted:
   driver escalation, dispatcher acknowledgement, maintenance hold, and manual
   operational tracking, with no fabricated automatic reassignment.
7. Obtain explicit safety/compliance and production change approval **before**
   running reviewed SQL on production or promoting any site deployment.

## Known release blockers
- Phase 9 staging SQL role/JWT simulation is not a substitute for real browser
  Auth/RLS smoke tests, and the production migration has not been authorized here.
- Vercel preview access/build limits must be resolved for final visual approval.
- Without the Phase 10 database trigger installed, browser recommendations alone
  are **not** enforceable dispatch holds. Existing manual safety procedures apply.
