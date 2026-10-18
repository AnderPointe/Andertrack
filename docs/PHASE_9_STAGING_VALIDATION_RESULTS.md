# Phase 9 — Staging validation record

**Scope:** Andertrack Staging (Supabase project `ofyfausfhinwgrfmapgc`). **No production database migration.**

## Confirmed state
- [PR #25](https://github.com/AnderPointe/Andertrack/pull/25) merged into `main` (`04a74941696360fd1e381d512da3d9c9b5f0a2f0`) and Vercel reported its production build **READY**. This deploys the UI but does not enable persistence.
- Stage migration `andertrack_phase9_class_c_dvir_service_staging`, version `20261018023557`, **applied successfully** to `Andertrack Staging` via Supabase `apply_migration`.
- Stage tables created: `at_vehicle_dvir_reports`, `at_vehicle_service_orders`, `at_vehicle_safety_events`. All three have RLS enabled; PostgreSQL owns their SECURITY DEFINER functions.
- All three tables grant `authenticated` **SELECT only** (not INSERT or UPDATE) and no direct write grants to `anon`. The four RPCs are executable by `authenticated`, not `anon`.
- A separate read-only production query confirmed all three tables **absent** from production. Production database untouched by this staging task.

## Staging transaction test — PASSED
A temporary fixture was created within one explicit SQL transaction, using the existing staging organization/user plus rollback-only driver profile, cargo van and active Class C assignment. The test ran as the `authenticated` SQL role using a simulated JWT subject, with the membership temporarily switched between driver and dispatcher. All fixture writes were rolled back.

| Check | Result |
|---|---|
| Driver submits an attested own-vehicle defect, receives a real database ID | PASS |
| RLS allows the driver to read their own report | PASS |
| Driver cannot create dispatcher service orders | PASS |
| Driver cannot report a defect in an organization to which they do not belong | PASS |
| Driver cannot report a vehicle not attached to their own active assignment | PASS |
| Missing eyewitness attestation is rejected | PASS |
| Dispatcher can create a work order linked to the actual defect | PASS |
| Dispatcher can acknowledge a report | PASS |
| Cannot close an out-of-service defect before completing the linked work order | PASS |
| Dispatcher can transition scheduled → in service → completed with notes | PASS |
| Dispatcher can then administratively close the report | PASS |
| Exactly six expected append-only audit events recorded during the transaction | PASS |
| Explicit ROLLBACK leaves **0** staging vehicles, assignments, defects, orders and safety events | PASS |

Separate privilege checks also confirmed the four RPCs are unavailable to `anon` and client table writes are not granted.

## Limitations and release gates
- **These are database-level tests using simulated JWT claims**, not end-to-end tests through the Supabase Auth network API. They do not prove the entire authenticated browser flow or correct deployment environment variables.
- Staging currently has one authenticated admin membership but **zero vehicles/assignments**. Browser testing the positive driver-submission flow requires a safe, authorized staging driver account and staging-only assigned vehicle.
- The imported Northvale metric/alerts/maintenance-cost figures remain **fictional demonstration data**.
- Work-order completion and administrative DVIR closure **do not certify mechanical roadworthiness**, driver compliance or legal DVIR signing. The dispatch offer engine has **not yet implemented an automatic block** for an unresolved out-of-service report. Safety-critical defects must still follow current human hold/dispatch procedures.
- Next gate: authenticated staging browser smoke tests with admin, dispatcher and driver accounts; cross-tenant UI/API checks; audit retrieval and error states; then safety/compliance review of formal DVIR, technician qualifications, release-to-service, retention, and emergency escalation.
- **Do not run migration against production or merge additional safety-rule changes without separate explicit approval.**

## Follow-up
Consider an independent Phase 10 review-only assignment safety interlock: block new vehicle allocations with open OOS DVIRs; route urgent reports to dispatch, and require an approved release-to-service workflow rather than treating work-order completion alone as clearance.
