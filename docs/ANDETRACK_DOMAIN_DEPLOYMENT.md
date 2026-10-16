# Andetrack.com — GitHub + Vercel + Supabase deployment

**Status:** Deployment configuration only; does NOT provision a Vercel site, alter DNS, activate Supabase production migrations, or bind the domain. All those steps must be verified independently.

## Existing resources

- Public domain: **andetrack.com** (not the GitHub repo spelling).
- Source repository: https://github.com/AnderPointe/Andertrack
- App stack: Vite + React, output in `dist/`.
- Production Supabase URL: `https://xzxxdzmkvophmrnovshs.supabase.co` — currently contains existing GPS tables only. The core Andertrack organization/assignment tables have NOT been activated there.
- Staging Supabase URL: `https://ofyfausfhinwgrfmapgc.supabase.co` — migrated for Phase 2–4 database testing; do not treat it as public production.
- Authentication: magic-link email via Supabase Auth, with redirect set to the current browser origin.

## Hosting: Vercel Git integration

1. Connect Vercel to the **AnderPointe** GitHub account (Vercel GitHub integration).
2. Import the `AnderPointe/Andertrack` repo into a new Vercel project called `andetrack` (or choose the existing hosted project if the domain is already deployed there).
3. Framework: `Vite`; install command: `npm install`; build command: `npm run build`; output directory: `dist`; production branch: `main`. The `vercel.json` file configures SPA history fallback.
4. **First test with a Vercel preview deployment**, without changing DNS or exposing a production workflow. Add Preview environment values for:
   - `VITE_SUPABASE_URL=https://ofyfausfhinwgrfmapgc.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<STAGING project's publishable key>`
5. In the staging Supabase project, set Authentication > URL Configuration to permit the **exact Vercel preview URL** as a redirect destination. Test passwordless sign-in with a deliberately provisioned staging user and roles.
6. Set Production environment values (only after production migrations and RLS review are approved):
   - `VITE_SUPABASE_URL=https://xzxxdzmkvophmrnovshs.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<PRODUCTION project's publishable key>`
7. Build-time Vite variables are bundled into frontend assets; never put a service-role/secret key, database password or personal token in a `VITE_*` variable. Each Vercel environment should use its **matching** Supabase key and URL.
8. When the app has passed preview and is actually ready for public use, add `andetrack.com` and (optionally) `www.andetrack.com` in Vercel Project > Settings > Domains. Use **the exact DNS record values Vercel provides for your project**. Do not replace existing DNS records before verifying ownership and preserving unrelated email/MX/TXT records.
9. In *production* Supabase > Authentication > URL Configuration, set the Site URL to `https://andetrack.com`; add allowed redirect URLs `https://andetrack.com/**` and, if in use, `https://www.andetrack.com/**`. Restrict preview redirects to staging Supabase only. Configure mail delivery/rate limits appropriately before launch.
10. Verify HTTPS certificate, domain ownership, DNS, `www` redirect, Auth callback, persistent React navigation routes and tenant isolation, and confirm that production uses the production Supabase ref in the deployed build.

## Critical release gates

- **Do not point andetrack.com to a staging database**. Preview builds use staging, public builds use production only after approval.
- Production migrations in `supabase/migrations/` have not been applied. A successful frontend build does not activate those databases.
- The Phase 4 fleet/POD application remains in a separate PR, and cannot be assumed deployed from `main`.
- Do not enable public signup without an organization invitation/provisioning policy. The application currently displays an access-pending state for users without a role.
- No domain DNS registrar access or active hosting project connection has been confirmed through this automation. The custom-domain step needs the DNS hosting provider and authorization to update records.
- The existing production GPS tables have RLS enabled but have not yet been assigned the approved organization-scoped location policies.
- Confirm GitHub integration deployment logs and Supabase Audit/Security advisor status before calling the domain live.

## Current readiness

| Step | Status |
| --- | --- |
| GitHub source repository | Connected/readable |
| Supabase project endpoints | Confirmed |
| Staging Phase 2–4 database | Migrated and tested at the SQL/RPC level |
| Vercel configuration checked into GitHub | Prepared in this branch |
| Vercel app connected to GitHub | Pending account authorization |
| Custom domain verified and DNS updated | Pending DNS provider information |
| Production Supabase schema and qualified driver workflows | Not yet approved/deployed |
| Live end-to-end website | Not yet validated |

## Rollback

- Vercel: use the prior deployment from the hosting dashboard. Avoid repointing DNS to an untested deployment.
- DNS: record the original A/CNAME records and TTL before modifying. Keep MX/SPF/DKIM/DMARC untouched.
- Supabase: production migrations require a separate backup, staged RLS tests and approval. No destructive production schema operations should be performed to launch a domain.
