# Phase 10 Staging Validation — 2026-10-18

Environment: **Andertrack Staging** (project ref `ofyfausfhinwgrfmapgc`). Production project `xzxxdzmkvophmrnovshs` was not modified.

## Migration result
- Applied `andertrack_phase10_dispatch_safety_interlocks_staging` at migration version `20261018073057` through Supabase's migration API.
- Prerequisite Phase 9 migration already present at version `20261018023557`.
- Confirmed the two safety triggers exist and cover INSERT/UPDATE on their intended tables.
- Confirmed `at_dispatch_vehicle_safety_status` is a **SECURITY INVOKER** RPC executable by `authenticated` and not `anon`.
- Confirmed the private SECURITY DEFINER trigger functions are **not directly executable** by `authenticated` or `anon`.
- Verified a partial index on open, severe defects is installed.
- GitHub Actions validated the current Phase 10 commit successfully, including regression tests and a build.

## Incomplete validations / release blockers
- This inspection does **not** prove a real driver/dispatcher browser login or two-tenant JWT/RLS isolation.
- **Rollback-only SQL role/JWT simulation completed:** 11 assertions passed in Andertrack Staging. Verified authorized planner safety counts (three scoped units, two open OOS holds), foreign-organization planner RPC denial, cross-organization RLS read isolation, unsafe offer rejection, unsafe FIFO claim rejection with queue head intact, safe offer success, unsafe acceptance rejection, safe driver decline, unsafe active-status advancement rejection, owned assignment DVIR submission, and driver denial for the planner-only safety RPC. Runbook: `tests/sql/phase10_staging_rollback_smoke.sql`. This was executed twice: first with an ad hoc equivalent transaction and again from the exact committed test file.
- **Transaction cleanup verified:** post-ROLLBACK counts were zero for synthetic vehicles, assignments, driver profiles, dispatch requests, DVIR reports, safety events, assignment events and synthetic auth users. The test file uses random IDs and ends in `ROLLBACK`.
- **Still pending:** two concurrent database sessions racing a new severe defect against an offer/acceptance, plus real Supabase Auth browser credentials (SQL role/JWT simulation is not a browser sign-in). No operational test records were retained.
- Active status advancement rejection **was verified at the database RPC layer** for an accepted load with an open severe defect. Driver notification, documented manual safety escalation and browser workflows have **not** been verified.
- Vercel build readiness is not equivalent to authenticated browser visual QA.
- No mechanic-certification, FMCSA-compliance, or automatic return-to-service determination is claimed.

## Security advisor results
- Four existing Phase 9 public SECURITY DEFINER RPCs remain intentionally executable by `authenticated`; each requires review of in-function org/role checks. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.
- Leaked-password protection is disabled in staging. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Release governance
Leave PR #29 in draft and unmerged. Do not deploy Phase 10 to production until the fixture-backed staging scenarios, concurrent transaction/race tests, security/compliance review, and authenticated preview smoke tests are complete. The trigger is installed in staging only.
