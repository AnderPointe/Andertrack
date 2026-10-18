# Phase 9 — Persistent Class C Safety & Maintenance Records (review)

## Current production
- GitHub main at merged Northvale PR #24, with the Class C dashboard, GPS map, 3D vehicle viewer, synthetic maintenance planner and exportable local DVIR drafts.
- Verified production schema has `at_vehicles`, `at_assignments`, `at_driver_profiles`, `at_organization_members`, but **NO real DVIR or maintenance work order tables**.
- This PR only changes source on a feature branch. **Migration has NOT been applied anywhere** and thus authenticated save buttons will not activate in production without explicit migration approval.

## Database migration
Review `supabase/sql/class_c_dvir_service_rls_review.sql`. It creates:
- `at_vehicle_dvir_reports`: authenticated driver's specific equipment/assignment defect submission, severity, attested server timestamp, and dispatcher review status.
- `at_vehicle_service_orders`: source-defect links, scheduled dates, workshops, owner, status, and completion notes.
- `at_vehicle_safety_events`: server-inserted append-only records for every submission/review/order transition.

Row-level security grants **read-only** client access restricted by organization membership and driver ownership. No direct client INSERT/UPDATE/DELETE rights. All writes must use authenticated SECURITY DEFINER functions:
- `at_submit_vehicle_dvir`: checks `auth.uid()` is role `driver` in the specified organization; checks the driver currently owns the exact `vehicle_id` on the exact active `assignment_id`. Requires explicit user attestation.
- `at_create_service_work_order`: organization admin/dispatcher only; validates vehicle organization, optional source DVIR organization and vehicle, and task length.
- `at_update_service_work_order`: enforces `scheduled → in_service → completed` or cancellation and requires completion notes.
- `at_review_vehicle_dvir`: dispatcher/admin only; only approved state transitions; requires review notes; an `out-of-service` defect cannot be administratively closed unless a completed work order is linked to it.

These are **auditable administrative safety records, not legally compliant DVIR electronic signatures, mechanic credentials, official release-to-service, certified FMCSA inspection, or an automated vehicle safety lockout**. Real launch must define those requirements separately with fleet safety/compliance personnel. Until full authorization, unsafe vehicles must still be held out of service through established dispatch and maintenance procedures.

## Frontend
- Driver's `Class C Shift` DVIR modal now probes for the server integration. When absent, the original **export unsubmitted draft** is retained. When enabled, the authenticated driver is offered a separate **Submit defect to fleet database** button requiring a checked eyewitness attestation. It only submits when the selected unit matches the logged-in driver's own current assignment. Displays server-confirmed record ID or an explicit error.
- Dispatcher/admin **Class C Fleet → Service Plan → DVIR & Maintenance Work Orders** panel lists real organization-scoped data and supports creating a work order, tracking service, reviewing defects, and administrative closure. No production record is fabricated; when migration is missing, the panel explains that no backend is connected. The existing Mon–Fri timetable remains explicitly a local sample/draft, not a persistent work order.
- All write actions are guarded by server authorization; UI role checks alone are never trusted. Client fetches use existing `supabase` session, organization scope, RLS and request-generation guards to prevent stale org data from appearing after a membership switch.
- No writes to `at_assignments`, no change to assignment acceptance/offer RPCs, no delivery/ePOD changes, no credentials or environment variables.

## Release plan
1. Review SQL function ownership, org memberships, permission grants, RLS and required defect/repair workflow with an admin and safety/compliance owner.
2. CI: `npm test` and `npm run build` green; review Vercel preview for latest commit.
3. Create/refresh a staging environment with safe test organization, driver, dispatcher and matching assignment. Apply reviewed migration **to staging only**, then test:
   - driver can submit a defect on **their own** current assignment, but cannot submit for other unit, expired load, different org, or without attestation;
   - admin/dispatcher can create/complete an order and review a defect only within their organization;
   - attempt to close OOS without completed linked service order fails;
   - cross-tenant reads/writes and anonymous writes fail;
   - service audit events cannot be edited or erased by the client.
4. Authenticated browser smoke tests, accessibility checks, mobile layout, network failures and source fallback when tables not installed.
5. If accepted, schedule production migration and deploy in a separate explicitly authorized step. No staging/production migrations are executed by this PR.
6. Future phase: reconcile assignment offer engine and safety holds to reject equipment with open high-risk defects; confirm legally sufficient DVIR signing/review, mechanic qualifications, data retention and incident escalation before claiming compliance.

Note: Existing sample figures (128 vehicles, fake OEM health percentages, Northvale forecast) remain **demo-only**; no connection to real diagnostic sensors exists.
