# Andertrack Phase 3 — Secure Driver Assignment Workflows

## Delivered in this PR

- Dispatchers can select an eligible vehicle, then a verified, available driver, and submit a load offer.
- Assigned drivers can accept or decline an offer.
- Accepted drivers can mark pickup arrival, cargo pickup, and transit start.
- Delivery completion is **intentionally disabled** until reliable proof-of-delivery and cargo handoff are implemented.
- Every allowed database transition records an `at_assignment_events` audit event in the same transaction.
- Conflicting load offers are serialized with row locks and cannot silently overwrite one another.
- Drivers may not edit assignments, statuses, profiles or vehicle data directly from the browser.
- License, availability, organization membership and vehicle eligibility checks are performed server-side, not only in UI filters.
- A pilot rule blocks a second active assignment for the same driver. Batching and multi-stop route optimization require a later version.
- This does not automatically determine DOT licensing requirements, vehicle ratings, HOS eligibility, endorsements, cargo insurance, or restricted commodity handling.

## Database prerequisite

The connected production Supabase project `xzxxdzmkvophmrnovshs` currently has ONLY `driver_location_current` and `driver_location_events`; Phase 2 `at_*` tables have **not** been deployed.

**Do not** run the Phase 3 script before an approved Phase 2 migration.

1. Review `supabase/sql/phase2_schema_review.sql` in staging, including explicit RLS access and organization creation/provisioning.
2. Convert it to a migration using `supabase migration new <name>`.
3. Apply to staging and verify security isolation with users in at least two organizations.
4. Review `supabase/sql/phase3_assignment_workflows_review.sql` and convert it to its own ordered migration.
5. Apply it to staging; check public function execution grants and audit inserts.
6. Run Supabase security/performance advisors; resolve findings before production approval.
7. Provision organizations, organization members, verified driver profiles and eligible vehicles using a trusted administrative service. Never allow client-side writes to membership/verification tables.
8. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in a deployment secret environment and configure Supabase Auth redirect URLs. The publishable key is public by design; avoid putting privileged keys in the frontend.
9. Approve production migrations after backups and a rollback plan have been reviewed.

## Expected RPC API

- `at_offer_assignment(p_assignment_id, p_driver_user_id, p_vehicle_id)`
- `at_respond_assignment(p_assignment_id, p_accept)`
- `at_advance_assignment(p_assignment_id, p_next_status)`

Each endpoint is exposed in `public` as a **SECURITY INVOKER** wrapper with authenticated-only EXECUTE. The implementation is `SECURITY DEFINER` in an unexposed `at_private` schema and explicitly validates `auth.uid()` and the assignment organization. No service-role key is used in browser code.

## Pilot lifecycle

```text
unassigned
   |
   | dispatcher offers to verified eligible driver/vehicle
   v
offered ----declined----> unassigned
   |
   | driver accepts
   v
accepted --> at_pickup --> picked_up --> in_transit
                                            |
                                            | later proof of delivery + audit
                                            v
                                         delivered
```

## Validation matrix

- Authenticated dispatcher can offer only within their organization.
- Dispatcher cannot offer a load already assigned or offered.
- Driver cannot see or respond to another driver's offer.
- Declining clears driver and vehicle, and returns the load to dispatch.
- Class C driver cannot operate vehicles requiring A/B.
- CDL freight cannot be offered to vehicles configured as Class C only.
- Unverified/unavailable drivers are rejected by the database.
- Driver with existing active job is rejected (pilot no-batching policy).
- Concurrent offers do not allocate the same driver to conflicting loads.
- Driver cannot skip stages or mark a shipment delivered without POD.
- Assignment transition plus audit row occur atomically, or neither is saved.
- RLS prevents cross-organization reads even if client query filters are manipulated.
- Realtime change events plus periodic refresh update the UI without showing demo records as live.
- Sign-out and organization switching clear previous scopes' data.
- GitHub Actions production build must pass after this commit.

## Remaining work

- **Phase 4:** Proof of delivery capture, cargo item scanning, driver location tracking authorization, incident escalation, and eligible driver/vehicle onboarding.
- **Phase 5:** Driver earnings and quote calculation, multi-stop route planning, courier batching, and merchant delivery.

The files under `supabase/sql/` are REVIEW-ONLY SQL, not executed database migrations. The data model and production state must be reconciled before deploy.
