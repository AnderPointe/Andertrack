# Phase 10 — Real Auth, browser and escalation sign-off (staging only)

**Status: NOT YET EXECUTED WITH REAL AUTH CREDENTIALS.** This is an operator
runbook and deliberately does not include credentials, session tokens, live
user details, or production connection strings.

## Known environment / release barrier
- Andertrack Staging: `ofyfausfhinwgrfmapgc`. Phase 9, Phase 10 and
  active-equipment exclusivity SQL exist there.
- The production Anderroute Supabase project `xzxxdzmkvophmrnovshs` does
  not have Phase 9/10 tables/migrations. Never reuse production credentials.
- A GitHub/CI successful Vercel READY preview is **not** authenticated QA.
  The ChatGPT Vercel integration currently returns a 403 for the protected
  preview and no authorized Vercel teams.
- This script NEVER writes DVIRs, work orders or dispatch assignments.

## One-time isolated Auth fixtures (staging administrator only)
Create dedicated, non-production staging identities with email/password login.
Use the normal Supabase Auth administration flow, **not** manually constructed
or client-editable JWT role metadata.
1. Two separate staging organizations A and B. Each must have a dispatcher
   membership; organization A also has a driver membership.
2. Valid staging organizations must each have appropriate RLS-visible records.
   Organization A needs a Class C vehicle with an **open out-of-service DVIR**
   that the dispatcher can see and an authorized driver-owned DVIR.
3. Seed another nonclosed DVIR in A owned by a **different** staging driver.
   Record its ID to verify driver A cannot see it. These must be nonproduction
   fixture identities; no real driver or safety data should be copied.
4. Create at least one DVIR in organization B to prove the B dispatcher
   can see real fixture data while dispatcher A cannot (avoids a vacuous
   zero-row RLS pass).
5. Record IDs for the two organizations, the OOS vehicle, a DVIR owned by
   driver A, and a DVIR owned by another A driver in a local secrets manager.
6. Use a **publishable** Supabase key. Do not use the service-role/secret key,
   and never commit passwords or `.env` files.

The current staging project has no retained vehicles, assignments or driver
profiles after rollback-only tests; fixture setup is a required prerequisite
for meaningful Auth browser QA. The test runner intentionally fails closed
when any required input is missing.

## Real Supabase Auth smoke runner
The standalone executable is
`scripts/phase10-authenticated-staging-qa.mjs`. It calls genuine
`signInWithPassword` and `getUser`, then performs RLS-scoped **reads** and
the planner safety snapshot RPC. Session creation and sign-out are the only
authentication-side effects; no operational data mutations are made.

Set these locally, through your workstation's secure environment manager:

```text
P10_STAGING_URL=https://ofyfausfhinwgrfmapgc.supabase.co
P10_STAGING_PUBLISHABLE_KEY=<staging publishable key>
P10_ORG_A=<staging organization A UUID>
P10_ORG_B=<staging organization B UUID>
P10_DISPATCHER_A_EMAIL=<staging dispatcher A email>
P10_DISPATCHER_A_PASSWORD=<staging dispatcher A password>
P10_DRIVER_A_EMAIL=<staging driver A email>
P10_DRIVER_A_PASSWORD=<staging driver A password>
P10_DISPATCHER_B_EMAIL=<staging dispatcher B email>
P10_DISPATCHER_B_PASSWORD=<staging dispatcher B password>
P10_OOS_VEHICLE_ID=<staging vehicle with open OOS defect>
P10_DRIVER_A_DVIR_ID=<staging DVIR authored by driver A>
P10_OTHER_DRIVER_DVIR_ID=<staging DVIR authored by another driver in org A>
P10_ORG_B_DVIR_ID=<staging DVIR authored inside org B>
```

Once variables are available locally and dependencies installed:

```bash
node scripts/phase10-authenticated-staging-qa.mjs
```

The runner **refuses any URL** other than the exact staging project host
and never logs passwords, keys, or bearer tokens. Nonzero exit indicates
missing prerequisites or failed QA. Passing the runner demonstrates
authenticated reads and RLS/RPC role scope, **not** browser layout QA or
an operational safety/ELD certification.

## Protected Vercel preview and manual browser checklist
First reconnect the Vercel integration with access to the
`flygeek88-5522` team and verify the exact QA preview revision corresponds
to the intended PR #30 head. **Audit Vercel preview environment variable
`VITE_SUPABASE_URL` first: it MUST resolve to the staging Supabase host,
not the production database. Do not log into a preview whose target
cannot be verified.** Keep Vercel Deployment Protection enabled;
do not use long-lived bypass secrets in chat.

With separate browser profiles and **staging-configured preview only**:
1. Dispatcher A: sign in, open Class C Fleet → Service Plan. Verify real
   open severe defects are visible, with no sample counts or fake signing.
2. Driver A: own DVIR visible; another driver's report and maintenance
   administrative controls unavailable.
3. Dispatcher B: organization A DVIR and vehicle data are not visible,
   including after switching organization or refreshing.
4. Dispatcher A: open Dispatch Decision Studio. Open OOS vehicle is marked
   blocked; unknown or stale snapshot must not show it as cleared.
5. Use the existing rollback DB tests for write denial. Do **not** issue a
   real dispatch offer to a driver merely for the browser smoke test.
6. Repeat on narrow mobile viewport: navigation, filtering, readable
   OOS warnings, keyboard/assistive-tech focus, network loss and session
   expiration.
7. Capture only scrubbed screenshots and checklists. Never export tokens,
   personal driver information, or sensitive DVIR details into PR comments.

## Incident-response procedure (manual pending approved automation)
An out-of-service report filed **after an offer or during travel** can
coexist with an active load. An initial offer safety check does not
automatically contact a driver or cancel the existing assignment.

Proposed procedure requiring the fleet safety owner's formal approval:
- **Dispatch/yard coordinator:** On identifying the severe DVIR, contact
  the affected driver immediately using approved company communications;
  instruct a safe stop and established out-of-service procedure. If the
  driver is moving, do not encourage unsafe abrupt stopping.
- **Fleet safety:** Record issue, driver confirmation, vehicle/unit, current
  load, safe stop location, and escalation owner in the approved incident
  system. Do not claim that read-only UI controls created a persisted hold.
- **Maintenance:** Evaluate the reported defect, inspect/repair equipment,
  document qualified personnel and supporting evidence according to policy.
- **Dispatcher:** Record disposition and coordinate recovery, replacement
  equipment or customer updates only through authorized workflows; never
  manually bypass the server OOS or active-vehicle checks.
- **Return to service:** Follow approved legal/safety clearance procedures.
  Administrative DVIR closure or a completed work order **alone** does not
  certify roadworthiness or remove independent operational restrictions.

Until escalation notifications and certified return-to-service controls are
designed, this is a manual operational procedure, not automated enforcement.

## Release sign-off checklist
- [ ] Real staging Auth login and RLS runner passed with 3 distinct users.
- [ ] Authorized staging preview desktop/mobile QA recorded.
- [ ] Safety owner approves stop/escalation and return-to-service process.
- [ ] Security owner reviews Phase 9 public authenticated SECURITY DEFINER
  RPCs and the staging leaked-password protection warning.
- [ ] Database owner confirms Phase 10 exclusive vehicle lock behavior and
  production rollback plan.
- [ ] Explicit production migration/deployment authorization granted
  separately. **No approval is implied by any test result.**
