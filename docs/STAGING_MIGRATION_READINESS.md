# Andertrack Phase 2–4 Staging Migration Readiness Review

**Status: BLOCKED for execution pending staging-branch cost approval.** No production changes have been made. The source SQL in `supabase/sql/*_review.sql` is not yet a numbered, validated migration series.

## Verified baseline (16 October 2026)

- Production Supabase project `xzxxdzmkvophmrnovshs` is ACTIVE_HEALTHY on PostgreSQL 17.
- Existing public tables: `driver_location_current`, `driver_location_events`. Both have RLS enabled and **no policies**.
- Supabase migration history has zero recorded migrations.
- No staging branch currently exists.
- Phase 4 work is in PR #4, not `main`.
- Creating a Supabase database branch requires separate cost authorization. The tool refused to create it without a cost confirmation ID.

## SQL security review findings — must fix/test before production

| Severity | Finding | Remediation / staging test |
| --- | --- | --- |
| Blocker | Phase 2 creates organization/role/vehicle/assignment tables, but no trusted organization bootstrap and driver eligibility provenance | Use an admin-only provisioning workflow; do not enable ordinary user writes to memberships or verification. Test privilege escalation. |
| Blocker | Current GPS tables lack policies and organization relationship is assumed from `driver_location_current.company_id` | Reconcile organization UUID namespace with actual GPS ingestion; test cross-tenant reads. Do not deploy GPS read policy until mapping is verified. |
| Blocker | Phase 3 authorization only checks simple license A/B/C, availability and one active assignment | Implement verified vehicle ratings, endorsements, commodity restrictions, insurance, HOS and overlapping job controls before true dispatch. Avoid representing baseline license checks as legally sufficient. |
| High | Phase 3 private definer functions are granted EXECUTE to authenticated for public wrappers to invoke | Test that private schema is not exposed by PostgREST, functions use fixed search_path, every path checks auth.uid, role, organization and object state. |
| High | Phase 4 storage insert policy relies on a path and uploader's claimed MIME | Confirm storage path folder numbering, private bucket, size/type and owner restrictions; validate file content in trusted workflow. Test URL leaks and cross-tenant access. |
| High | Proof upload occurs before SQL confirmation so failed RPC creates orphaned private objects | Add trusted cleanup with a retention delay, audit and metrics; do not delete customer evidence immediately. |
| High | Phase 4 package scan tracking code selection and manifest creation require provenance and stop-level custody rules | Implement trusted package/stop creation before routing, verify reject nonexistent/duplicate scans and empty manifests where shipment requires them. |
| High | No staging test identities or negative tests for tenant isolation and driver spoofing yet | Create disposable org A/org B, dispatcher A/B, CDL A/B, Class C driver, and a nonmember. Exercise anonymous, wrong-tenant and invalid state transitions. |
| Medium | Several SQL review scripts are not CLI-generated migrations, and Phase 4 has a dependency on its open PR | Generate migration filenames with the Supabase CLI, reconcile SQL in staging, then commit timestamped ordered migrations after green tests. |
| Medium | Existing public function `set_updated_at` has a mutable search_path; leaked-password protection disabled | Follow Supabase security advisor remediation as a separate audited change. |
| Medium | CI currently verifies frontend build only, not SQL application or behavior | Add isolated Postgres/Supabase tests and fail the release gate on any permission or flow regression. |

## Required execution gates

1. Select and approve the billing organization and **quoted staging branch cost**.
2. Create a development branch of the existing Supabase project with an independent database and capture its project ref. Never use production for `execute_sql` experiments.
3. Inspect branch security baseline and migration history. The branch starts without production data.
4. Generate actual ordered migration filenames with `supabase migration new`, not manual invented timestamps; review each script in dependency order.
5. Apply Phase 2, Phase 3, Phase 4 package/POD and Phase 4 GPS only to the staging project.
6. Run `tests/phase2_4_staging_security.sql` read-only checks plus authenticated role-scoped integration tests.
7. Resolve security/performance advisors, document cleanup and rollback.
8. Return detailed passed/failed evidence for user approval. **Do not run any production migration without a new explicit instruction.**

## Functional test matrix

- Anon and unrelated tenant cannot read assignments, driver profiles, GPS, package scans, POD or photos.
- Org A dispatcher can offer only Org A jobs to qualified Org A drivers.
- Org B drivers cannot accept or view Org A offers, even with guessed IDs.
- No driver can skip an assignment stage; only the assigned driver can advance.
- Class C driver cannot accept a Class A/B-required vehicle; unavailable or unverified drivers are rejected.
- Concurrency: two dispatchers offer the same job or the same driver concurrently — at most one valid offer.
- Decline atomically clears driver and vehicle and records immutable audit.
- Courier package pickup must precede delivery; duplicate and unrelated scans fail.
- Shipment cannot be delivered without required package scans and private POD, including when a privileged job attempts an invalid status update.
- Public Storage read URL fails; cross-tenant object access fails; authorized tenant access succeeds.
- No service-role or secret key is present in client build/deployment variables.
- Existing production GPS history remains unchanged.
