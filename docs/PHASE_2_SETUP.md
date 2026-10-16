# Andertrack Phase 2 — Secure Operations

## Scope

This branch adds an authenticated, **read-only** Supabase assignment board and an organization/role-aware driver view. It also keeps the existing sample UI behind an explicit Demo mode. No live shipment updates or GPS history changes are performed.

Supabase project: `xzxxdzmkvophmrnovshs`.

## Configuration

Set these variables in the development or deployment environment:

```env
VITE_SUPABASE_URL=https://xzxxdzmkvophmrnovshs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your project publishable key>
```

The publishable key is safe for browsers **only when RLS correctly protects the data**. Never put a database password, service role key, or Supabase personal access token in `VITE_*` values or GitHub source. Include all deployment URLs in Supabase Auth's redirect allowlist.

## Database plan — review before execution

Review `supabase/sql/phase2_schema_review.sql` against staging and current database state. It creates separate `at_*` tables so that existing `driver_location_current` and `driver_location_events` remain unchanged. RLS grants read access only to authenticated organization members; drivers see only their assignments. No browser writes are permitted.

This SQL is a **review script**, not a recorded migration. Generate a formally named migration with the Supabase CLI (`supabase migration new <name>`) once reviewed. Confirm `supabase migration list`, run advisors, test tenant isolation, and obtain approval before production application. Never blindly apply SQL to your live database.

## Bootstrap accounts

Do not give the browser INSERT permission to organization membership or driver-qualification tables. A trusted backend administrator should:

1. Create an organization.
2. Invite/authenticate users using Supabase Auth.
3. Insert `at_organization_members` rows with organization-scoped roles.
4. Add `at_driver_profiles` after verifying the license and appropriate equipment.
5. Add vehicles, then real assignments using a trusted server-side workflow.

All these tables start empty. The application shows **Organization access pending** until membership is provisioned. The workspace is read-only until an audited assignment mutation API exists.

## Test cases

- Sign-in magic link succeeds only for a correctly configured Auth redirect URL.
- Unauthenticated users cannot select assignment records.
- A driver sees only assignments for their own account, not another driver's.
- A dispatcher cannot view another organization's records.
- Multi-organization switching does not retain old shipment details.
- Realtime subscription updates relevant rows; polling recovers if disconnected.
- Unverified or missing driver profiles cannot be mistaken for approved qualification.
- Demo data never appears as production data.
- React production build succeeds.

## Local development

```sh
npm install
npm run build
npm run dev
```

For deployments, commit `package-lock.json` and switch CI to `npm ci` once the lockfile exists. The current build workflow uses `npm install` until that is done.
