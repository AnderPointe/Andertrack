# Andertrack Phase 2–4 — Staging Validation Report

**Date:** 2026-10-16  
**Production project:** `xzxxdzmkvophmrnovshs` (**no schema or data changes**)  
**Isolated staging project:** `ofyfausfhinwgrfmapgc` (ACTIVE_HEALTHY, US East)  
**Billing:** User approved Supabase's separate staging project quote of **$10/month**. The original branching option was unavailable on the plan.

## Migration application — PASS

Applied through Supabase's migration API to staging only:

| Version | Name | Result |
|---|---|---|
| 20261016222646 | andertrack_phase2_tenant_core_staging | PASS |
| 20261016222706 | andertrack_phase3_assignment_rpc_staging | PASS |
| 20261016222759 | andertrack_phase4_packages_pod_staging | PASS after SQL dollar-quote correction |
| 20261016222830 | andertrack_staging_gps_schema_fixture | PASS — staging-only table shape, **never deploy to production** |
| 20261016222837 | andertrack_phase4_dispatch_gps_rls_staging | PASS |
| 20261016223144 | andertrack_staging_foreign_key_indexes | PASS |

The matching deployable schema/index migration SQL is stored in `supabase/migrations/` for review. The GPS table-shape fixture is deliberately stored in `supabase/staging_only/` and **must never be included in a production migration**; the production database already has the real GPS tables.

## Authenticated DB authorization tests — PASS

A transactional staging test used disposable users, two isolated organizations, a dispatcher, a courier, real RPC calls and a courier package. All fixture rows were rolled back. Verified:

- Company A dispatcher sees Company A assignments and GPS, not Company B's records.
- Company B dispatcher cannot see Company A assignments or GPS.
- Cross-organization assignment offer is rejected by RPC.
- An assigned driver sees their own offer, their own driver profile, but not restricted fleet GPS.
- Driver accepts an offer; valid state transitions create audit history.
- Courier cannot advance past pickup while a manifested package is unscanned.
- Pickup package scan is authorized; the courier can then reach `in_transit`.
- Missing delivery package scan or nonexistent POD evidence is rejected.
- Anonymous role lacks SELECT permissions on assignments and GPS.
- Five assignment events and one package-scan event were written atomically during the test.
- Test transaction rolled back; staging organizations, assignments, events, GPS and test auth users returned to zero rows.

## Security and performance advisors

- **Security:** ZERO findings on staging at the end of tests.
- **Performance:** Missing foreign-key indexes were fixed in migration `20261016223144`; remaining advisories are `unused_index` on newly created empty tables (INFO, expected) and the built-in Auth connection strategy advisory (INFO).

## Corrected source bug

The Phase 4 review SQL in GitHub PR #4 included malformed `DO $` / `AS $` blocks. They were repaired and the corrected SQL has applied successfully in staging. The Phase 2 driver-profile RLS policy was tightened in the versioned staging migration: dispatchers can view their organization's roster while drivers can only view their own profiles.

## BLOCKERS: Do not deploy to production yet

1. **Production GPS mapping is unverified.** The stage fixture mirrors the expected table columns but contains synthetic identifiers. Confirm `driver_location_current.company_id` matches Andertrack organization IDs before enabling GPS policies in production.
2. **No end-to-end Storage API upload/download test.** Private bucket policies are installed and security advisor clean, but photo upload MIME validation, real authenticated uploads and signed-read behavior need staging browser/API tests.
3. **No simultaneous-offer stress test** or tested multi-stop courier handling.
4. **No active staging users invited via Supabase Auth**; tests simulate authenticated database claims in a controlled SQL transaction, not the complete email-magic-link flow.
5. **Baseline driver eligibility is insufficient for regulated operations:** HOS/ELD, license endorsements, vehicle weight/GVWR, insurance, hazmat and cargo qualifications need additional policy and integration work.
6. **Create a repeatable clean-install test** using Supabase CLI on a disposable environment and reconcile staging-only fixture history before treating these as deployable migrations.
7. **Object orphan cleanup, POD retention and audit procedures** remain to be designed.
8. **Phase 4 application PR #4 remains separate;** do not conflate a passing frontend build with complete authorization/integration testing.

## Final verification

- Staging: ten public tables; RLS enabled on all ten.
- Staging: 6 recorded migrations; no residual test users or shipments.
- Production: **still two original GPS tables and zero recorded migrations**.
- No production DDL, RLS or data writes were performed.

## Production release decision

**NOT APPROVED / NOT APPLIED.** Explicit user authorization and remaining integration/security tests are required first.

Supabase security guidance:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/storage/security/access-control
