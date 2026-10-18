# Phase 10 — Concurrency & Security Review (2026-10-18)

## Scope and immutable release boundary
The source Phase 10 PR #29 was independently merged at 2026-10-18 07:41:20 UTC.
Vercel reports a READY production deployment of its merge commit `5dae486`.
**The production Supabase project did not receive Phase 9/10 migrations in this
review**; its migration list ends at the Phase 5 staging-named foundation.
Frontend deployment is not evidence that production DVIR safety interlocks run.

This follow-up is **draft PR #30**, not merged. Only Andertrack Staging
(`ofyfausfhinwgrfmapgc`) was used for database testing and installation.
The production database (`xzxxdzmkvophmrnovshs`) was inspected read-only,
not modified. No production deployment was triggered by this review.

## Discovered high-priority safety gap
Phase 10 correctly rejects an *open out-of-service defect* on assignment
offer/acceptance. However the original offer RPC checks the driver's busy
assignments, but **does not independently exclude a vehicle already used on
another active assignment**. Before the new safeguard, the staging database
accepted an offer on a vehicle already linked to a different accepted load.
This violates one-active-assignment-per-vehicle dispatch expectations.

### Corrective review-only staging migration
`supabase/sql/phase10_active_vehicle_exclusivity_review.sql` creates:
- A private, locked-row, SECURITY DEFINER trigger function with pinned empty
  search_path and no `anon`/`authenticated` direct execute grants.
- A trigger that rejects overlapping assignments in `offered`, `assigned`,
  `accepted`, `at_pickup`, `picked_up`, or `in_transit` states,
  including offers, FIFO claims, accepted loads and equipment changes.
- An index to support the active-equipment conflict lookup.

Installed **staging only** as
`andertrack_phase10_active_vehicle_exclusivity_staging`.
Review the locking and any legitimate future shared-equipment/multi-load
requirements before production use.

## Actual staging test evidence
1. **Two connections: severe DVIR first, competing offer second.**
   The defect session held the vehicle row, then submitted an authenticated-
   role DVIR. The offer session waited, then rejected the offer with
   `Vehicle has an open out-of-service DVIR safety hold; dispatch denied`.
   The requested load remained unassigned. This was a real interleaving with
   separate database backends, not just sequential simulated checks.
2. **Reverse interleaving: offer first, severe report second.**
   Both transactions succeeded when the report followed an already committed
   offer. The now-offered vehicle had an open OOS defect. An urgent operational
   stop/escalation workflow remains necessary; this application does **not**
   automatically cancel or reassign existing offers. That run used the
   pre-exclusivity trigger and helped expose the double-booking gap.
3. **Two concurrent competing offers for the same vehicle, after fix.**
   Different backend connections ran separate authorized dispatcher offers.
   Exactly one succeeded; the second returned
   `Vehicle has another active assignment; dispatch denied`.
   Final count: **one** active vehicle assignment and **one** successful
   offer audit event.
4. **Phase 10 existing rollback-only tests:** All 11 assertions passed after
   the additional exclusive-equipment trigger was installed.
5. **Repeatable conflict regression:** Four assertions in
   `tests/sql/phase10_active_vehicle_exclusivity_rollback_smoke.sql`
   passed: direct duplicate offer denied, duplicate FIFO claim denied,
   queue head preserved, unassigned load unchanged.
6. **Fixture hygiene:** Both persisted synthetic-concurrency fixtures were
   deleted after the tests (verified zero remaining org, load, DVIR, and
   Auth-user rows); the role-simulation SQL tests ended in ROLLBACK.

## Authorization and privilege audit
- Direct `INSERT`, `UPDATE`, `DELETE` on assignments, DVIR reports, work
  orders and safety audit events are denied for `anon` and `authenticated`.
- Private safety-trigger functions are not directly executable by those roles,
  are in the non-exposed `at_internal` schema, and pin `search_path=''`.
- The read-only planner safety RPC is SECURITY INVOKER and grants execute
  only to `authenticated`, with an in-function organization/dispatcher check.
- All four Phase 9 public SECURITY DEFINER RPCs are intentionally
  `authenticated`-executable and `anon`-inaccessible; inspection confirms
  checks for authenticated user, membership and actor role. They use pinned
  `pg_catalog,public` search paths; `authenticated` and `anon` lack
  CREATE rights in public or private schemas. These findings require continued
  code-owner review, not automatic privilege removal that would break the UI.
- Supabase security advisor continues to warn about those four privileged
  Phase 9 RPCs and disabled leaked-password protection in staging.

## Remaining hard release gates
- **Real Supabase Auth browser sessions:** Not performed. SQL `SET ROLE` /
  `request.jwt.claim.sub` assertions validate Postgres RPC/RLS behavior
  but do not test GoTrue-issued token flow, frontend cookies, session refresh,
  cross-org account switching or mobile UX.
- **Vercel preview inspection:** The latest preview is READY, but the Vercel
  integration's access-bypass endpoint returns 403 and lists no authorized
  teams. Browser visual QA has not been completed.
- **Operations safety approval:** Must define immediate dispatch alert,
  manual stop/hold, repair review, certified vehicle return-to-service, and
  handling of an OOS report after offer or mid-route.
- **Conflict/business policy:** Approve one-active-load-per-vehicle policy
  for Class C and CDL operations; if shared equipment/multi-stop batching
  becomes supported, implement a separate safe aggregate assignment design.
- **Production gate:** Phase 9 schema and Phase 10 safety/exclusivity
  migrations are not applied to production, and must never be deployed
  solely because a Vercel frontend build passed.

## Next action
Keep PR #30 **draft and unmerged**. Obtain Vercel scope access, run real
authenticated-driver/dispatcher mobile/browser smoke tests in staging, complete
safety/compliance review, and authorize a separately scheduled production
schema rollout only after the hard gates pass.

Reference:
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
